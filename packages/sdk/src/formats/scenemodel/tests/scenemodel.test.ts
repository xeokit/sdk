import {encode} from "../versions/1_0/encode";
import {parse} from "../versions/1_0/parse";

// The scenemodel format delegates serialization to the SceneModel itself:
// encode() calls sceneModel.toParams(), parse() calls sceneModel.fromParams().
// So we round-trip through in-memory stubs that mimic those two methods,
// mirroring the stub style of cityjson.test.ts (and avoiding the renderer/math
// import graph that a real Scene would drag in).

const TrianglesPrimitive = 20002;

// A unit quad (2 triangles) in the XY plane, stored the way SceneModel.toParams
// emits geometry: compressed integer positions + an AABB.
const QUAD_POSITIONS_COMPRESSED = [0, 0, 0, 65535, 0, 0, 65535, 65535, 0, 0, 65535, 0];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];
const QUAD_AABB = [0, 0, 0, 1, 1, 0];

// A SceneModel-shaped source whose toParams() returns a SceneModelParams document.
function buildSource() {
  const params = {
    id: "myModel",
    coordinateSystem: {handedness: "right"},
    geometriesCompressed: [
      {
        id: "g1",
        primitive: TrianglesPrimitive,
        positionsCompressed: QUAD_POSITIONS_COMPRESSED,
        indices: QUAD_INDICES,
        aabb: QUAD_AABB,
      },
    ],
    meshes: [
      {id: "mesh1", geometryId: "g1", color: [0.2, 0.4, 0.6], opacity: 0.5},
    ],
    objects: [
      {id: "Building1", meshIds: ["mesh1"]},
    ],
  };
  const sceneModel: any = {
    toParams: () => ({ok: true, value: params}),
  };
  return {sceneModel, params};
}

describe("scenemodel format (SceneModelParams round-trip)", () => {

  it("encodes a SceneModel to a SceneModelParams document", async () => {
    const {sceneModel} = buildSource();

    const doc = await encode({sceneModel});

    expect(doc.id).toBe("myModel");
    expect(doc.coordinateSystem).toBeDefined();

    // Geometry is serialized in compressed form.
    expect(doc.geometriesCompressed).toHaveLength(1);
    const geom = doc.geometriesCompressed[0];
    expect(geom.id).toBe("g1");
    expect(geom.primitive).toBe(TrianglesPrimitive);
    expect(geom.positionsCompressed).toHaveLength(12);
    expect(Number.isInteger(geom.positionsCompressed[0])).toBe(true);
    expect(geom.indices).toEqual(QUAD_INDICES);
    expect(geom.aabb).toHaveLength(6);

    // One mesh referencing the geometry, carrying its colour.
    expect(doc.meshes).toHaveLength(1);
    expect(doc.meshes[0].id).toBe("mesh1");
    expect(doc.meshes[0].geometryId).toBe("g1");
    expect(doc.meshes[0].color).toEqual([0.2, 0.4, 0.6]);

    // One object owning the mesh.
    expect(doc.objects).toHaveLength(1);
    expect(doc.objects[0].id).toBe("Building1");
    expect(doc.objects[0].meshIds).toEqual(["mesh1"]);
  });

  it("propagates a toParams failure as a thrown error", async () => {
    const sceneModel: any = {toParams: () => ({ok: false, error: "boom"})};
    await expect(encode({sceneModel})).rejects.toThrow(/boom/);
  });

  it("round-trips the document back through fromParams", async () => {
    const {sceneModel} = buildSource();
    const doc = await encode({sceneModel});

    // Capture what parse() hands to the target SceneModel.fromParams().
    let received: any = null;
    const dst: any = {
      fromParams: (p: any) => { received = p; return {ok: true, value: undefined}; },
    };

    await parse({fileData: doc, sceneModel: dst});

    // The exact encoded document is what fromParams receives.
    expect(received).toBe(doc);

    // Geometry survived under its original id, as a triangle mesh.
    expect(received.geometriesCompressed).toHaveLength(1);
    expect(received.geometriesCompressed[0].id).toBe("g1");
    expect(received.geometriesCompressed[0].primitive).toBe(TrianglesPrimitive);
    expect(received.geometriesCompressed[0].indices).toEqual(QUAD_INDICES);

    // Mesh survived, still pointing at the geometry and carrying its colour.
    expect(received.meshes).toHaveLength(1);
    expect(received.meshes[0].geometryId).toBe("g1");
    expect(received.meshes[0].color).toEqual([0.2, 0.4, 0.6]);

    // Object survived owning the mesh.
    expect(received.objects).toHaveLength(1);
    expect(received.objects[0].id).toBe("Building1");
    expect(received.objects[0].meshIds).toEqual(["mesh1"]);
  });

  it("propagates a fromParams failure as a rejected promise", async () => {
    const {sceneModel} = buildSource();
    const doc = await encode({sceneModel});
    const dst: any = {fromParams: () => ({ok: false, error: "bad params"})};
    await expect(parse({fileData: doc, sceneModel: dst})).rejects.toThrow(/bad params/);
  });
});
