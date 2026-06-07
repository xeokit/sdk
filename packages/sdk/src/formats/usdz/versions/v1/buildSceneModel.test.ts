import {buildSceneModel, type USDSceneLike} from "./buildSceneModel";

/** Captures every create* call so we can assert on the SceneModel build. */
function fakeSceneModel() {
  const calls = {geom: [] as any[], mat: [] as any[], mesh: [] as any[], obj: [] as any[]};
  return {
    calls,
    createGeometry: (p: any) => { calls.geom.push(p); return {ok: true}; },
    createMaterial: (p: any) => { calls.mat.push(p); return {ok: true}; },
    createMesh: (p: any) => { calls.mesh.push(p); return {ok: true}; },
    createObject: (p: any) => { calls.obj.push(p); return {ok: true}; },
  };
}

const tri = {
  points: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  faceVertexIndices: new Uint32Array([0, 1, 2]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  materialId: 7,
};

// Column-major translation matrix.
const translate = (x: number, y: number, z: number): number[] =>
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

describe("buildSceneModel (USDZ → SceneModel mapper)", () => {
  it("emits geometry/material/mesh/object and shares geometry across instances", () => {
    // root xform → two mesh nodes that reference the SAME mesh (contentId 0).
    const scene: USDSceneLike = {
      getDefaultRootNode: () => ({
        nodeType: "xform",
        absPath: "/root",
        localMatrix: translate(10, 0, 0),
        contentId: -1,
        children: [
          {nodeType: "mesh", absPath: "/root/a", contentId: 0, localMatrix: translate(1, 0, 0)},
          {nodeType: "mesh", absPath: "/root/b", contentId: 0, localMatrix: translate(0, 2, 0)},
        ],
      }),
      getMesh: (cid) => (cid === 0 ? tri : null),
      getMaterial: (id) => (id === 7
        ? {diffuseColor: [0.2, 0.4, 0.6], opacity: 0.5, metallic: 0.1, roughness: 0.8}
        : null),
    };

    const sm = fakeSceneModel();
    const stats = buildSceneModel(scene, sm as any);

    // One geometry (deduped by contentId), one material, two meshes, two objects.
    expect(stats).toEqual({geometries: 1, materials: 1, meshes: 2, objects: 2, failures: 0});
    expect(sm.calls.geom).toHaveLength(1);
    expect(sm.calls.geom[0].positions).toBe(tri.points);
    expect(sm.calls.geom[0].indices).toBe(tri.faceVertexIndices);
    expect(sm.calls.geom[0].normals).toBe(tri.normals);
    expect(sm.calls.mesh).toHaveLength(2);
    expect(sm.calls.mesh[0].geometryId).toBe(sm.calls.mesh[1].geometryId); // shared
    expect(sm.calls.mesh[0].materialId).toBe("usd-material-7");
  });

  it("maps UsdPreviewSurface fields onto the material", () => {
    const scene: USDSceneLike = {
      getDefaultRootNode: () => ({nodeType: "mesh", absPath: "/m", contentId: 0}),
      getMesh: () => tri,
      getMaterial: () => ({diffuseColor: [0.2, 0.4, 0.6], opacity: 0.5, metallic: 0.1, roughness: 0.8}),
    };
    const sm = fakeSceneModel();
    buildSceneModel(scene, sm as any);
    expect(sm.calls.mat[0]).toMatchObject({
      id: "usd-material-7", color: [0.2, 0.4, 0.6], opacity: 0.5, metallic: 0.1, roughness: 0.8,
    });
  });

  it("composes local matrices down the hierarchy into world matrices", () => {
    // root translate(10,0,0) → child translate(1,0,0)  ⇒  world translate(11,0,0)
    const scene: USDSceneLike = {
      getDefaultRootNode: () => ({
        nodeType: "xform", absPath: "/root", localMatrix: translate(10, 0, 0), contentId: -1,
        children: [{nodeType: "mesh", absPath: "/root/m", contentId: 0, localMatrix: translate(1, 0, 0)}],
      }),
      getMesh: () => ({...tri, materialId: -1}),
      getMaterial: () => null,
    };
    const sm = fakeSceneModel();
    buildSceneModel(scene, sm as any);
    const m = sm.calls.mesh[0].matrix;
    expect([m[12], m[13], m[14]]).toEqual([11, 0, 0]);
  });

  it("dedupes colliding object ids from duplicate prim paths", () => {
    const scene: USDSceneLike = {
      getDefaultRootNode: () => ({
        nodeType: "xform", contentId: -1,
        children: [
          {nodeType: "mesh", absPath: "/dup", contentId: 0},
          {nodeType: "mesh", absPath: "/dup", contentId: 0},
        ],
      }),
      getMesh: () => ({...tri, materialId: -1}),
      getMaterial: () => null,
    };
    const sm = fakeSceneModel();
    buildSceneModel(scene, sm as any);
    const ids = sm.calls.obj.map((o) => o.id);
    expect(ids).toEqual(["/dup", "/dup_1"]);
  });

  it("skips empty / non-mesh nodes without emitting geometry", () => {
    const scene: USDSceneLike = {
      getDefaultRootNode: () => ({nodeType: "xform", contentId: -1, children: [
        {nodeType: "mesh", absPath: "/empty", contentId: 0},
      ]}),
      getMesh: () => ({points: new Float32Array([]), materialId: -1}),
      getMaterial: () => null,
    };
    const sm = fakeSceneModel();
    const stats = buildSceneModel(scene, sm as any);
    expect(stats.geometries).toBe(0);
    expect(stats.meshes).toBe(0);
  });
});
