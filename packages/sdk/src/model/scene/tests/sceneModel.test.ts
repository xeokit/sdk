import {Scene} from "../Scene";
import {TrianglesPrimitive} from "../../../base/constants";

// A unit quad (2 triangles) in the XY plane, spanning [0,0,0]..[1,1,0].
const QUAD_POSITIONS = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];
const QUAD_AABB = [0, 0, 0, 1, 1, 0];

// Translate the mesh by (10, 20, 30) so we can prove the local matrix survives
// the toParams/fromParams round-trip.
const TRANSLATE = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  10, 20, 30, 1,
];

/**
 * Builds a real, populated SceneModel: one geometry, one material, one mesh
 * (carrying the geometry + material + a translation matrix), and one object
 * owning that mesh. No build()/finalize() step is required — createGeometry /
 * createMaterial / createMesh / createObject register immediately.
 */
function buildModel(scene: Scene, modelId: string) {
  const model = scene.createModel({id: modelId}).value!;

  const geomRes = model.createGeometry({
    id: "g1",
    primitive: TrianglesPrimitive,
    positions: QUAD_POSITIONS,
    indices: QUAD_INDICES,
  });
  expect(geomRes.ok).toBe(true);

  const matRes = model.createMaterial({
    id: "m1",
    color: [0.2, 0.4, 0.6],
    opacity: 0.5,
    emissiveColor: [0.1, 0.2, 0.3],
  });
  expect(matRes.ok).toBe(true);

  const meshRes = model.createMesh({
    id: "mesh1",
    geometryId: "g1",
    materialId: "m1",
    matrix: TRANSLATE,
    color: [1, 0, 0],
  });
  expect(meshRes.ok).toBe(true);

  const objRes = model.createObject({
    id: "Object1",
    meshIds: ["mesh1"],
  });
  expect(objRes.ok).toBe(true);

  return model;
}

describe("SceneModel serialization", () => {

  it("serializes a built model to SceneModelParams via toParams()", () => {
    const model = buildModel(new Scene(), "model1");

    const res = model.toParams();
    expect(res.ok).toBe(true);
    const params = res.value!;

    expect(params.id).toBe("model1");

    // geometriesCompressed: one entry, quantised positions + decompression aabb.
    expect(params.geometriesCompressed).toHaveLength(1);
    const geom = params.geometriesCompressed![0];
    expect(geom.id).toBe("g1");
    expect(geom.primitive).toBe(TrianglesPrimitive);
    expect(geom.aabb).toEqual(QUAD_AABB);
    expect(geom.positionsCompressed!.length).toBe(QUAD_POSITIONS.length);
    expect(Array.from(geom.indices!)).toEqual(QUAD_INDICES);

    // meshes: carry geometryId + color, and reference the material + matrix.
    expect(params.meshes).toHaveLength(1);
    const mesh = params.meshes![0];
    expect(mesh.id).toBe("mesh1");
    expect(mesh.geometryId).toBe("g1");
    expect(mesh.materialId).toBe("m1");
    expect(Array.from(mesh.color as number[])).toEqual([1, 0, 0]);
    expect(Array.from(mesh.matrix as number[])).toEqual(TRANSLATE);

    // objects: carry their meshIds.
    expect(params.objects).toHaveLength(1);
    const obj = params.objects![0];
    expect(obj.id).toBe("Object1");
    expect(obj.meshIds).toEqual(["mesh1"]);

    // materials round-trip too (toParams serializes them even though the
    // doc-comment claims otherwise).
    expect(params.materials).toHaveLength(1);
    expect(params.materials![0].id).toBe("m1");
  });

  it("round-trips toParams() -> fromParams() into a fresh model", () => {
    const src = buildModel(new Scene(), "src");
    const params = src.toParams().value!;

    // Fresh Scene + empty model, then rebuild from the serialized params.
    const dstScene = new Scene();
    const dst = dstScene.createModel({id: "dst"}).value!;
    const fromRes = dst.fromParams(params);
    expect(fromRes.ok).toBe(true);

    // Equivalent counts.
    expect(Object.keys(dst.geometries)).toHaveLength(Object.keys(src.geometries).length);
    expect(Object.keys(dst.meshes)).toHaveLength(Object.keys(src.meshes).length);
    expect(Object.keys(dst.objects)).toHaveLength(Object.keys(src.objects).length);
    expect(Object.keys(dst.materials)).toHaveLength(Object.keys(src.materials).length);

    // Equivalent ids.
    expect(Object.keys(dst.geometries).sort()).toEqual(Object.keys(src.geometries).sort());
    expect(Object.keys(dst.meshes).sort()).toEqual(Object.keys(src.meshes).sort());
    expect(Object.keys(dst.objects).sort()).toEqual(Object.keys(src.objects).sort());

    // Geometry's decompression AABB survives losslessly (it's stored, not
    // re-derived), so the rebuilt boundary matches the original within
    // quantisation — exactly here, since the source positions defined it.
    const srcAabb = Array.from(src.geometries["g1"].aabb!);
    const dstAabb = Array.from(dst.geometries["g1"].aabb!);
    for (let i = 0; i < 6; i++) {
      expect(dstAabb[i]).toBeCloseTo(srcAabb[i], 4);
    }
    expect(dstAabb).toEqual(QUAD_AABB);
  });

  it("round-trips transform parents when a child serializes before its parent", () => {
    const src = new Scene().createModel({id: "srcTransforms"}).value!;
    expect(src.createTransform({id: "child", matrix: TRANSLATE as any}).ok).toBe(true);
    expect(src.createTransform({
      id: "parent",
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1] as any,
    }).ok).toBe(true);
    expect(src.transforms["child"].setParentTransformId("parent").ok).toBe(true);
    const params = src.toParams().value!;
    expect(params.transforms!.map(transform => transform.id)).toEqual(["child", "parent"]);

    const dst = new Scene().createModel({id: "dstTransforms"}).value!;
    const fromRes = dst.fromParams(params);

    expect(fromRes.ok).toBe(true);
    expect(dst.transforms["child"].parentTransform).toBe(dst.transforms["parent"]);
    expect(Array.from(dst.transforms["child"].matrix)).toEqual(TRANSLATE);
  });
});

describe("SceneObject", () => {

  it("exposes id and the meshes it owns; meshIds round-trip through toParams", () => {
    const model = buildModel(new Scene(), "objModel");
    const obj = model.objects["Object1"];

    expect(obj.id).toBe("Object1");
    expect(obj.meshes).toHaveLength(1);
    expect(obj.meshes[0].id).toBe("mesh1");
    expect(obj.model).toBe(model);

    const objParams = obj.toParams().value!;
    expect(objParams.id).toBe("Object1");
    expect(objParams.meshIds).toEqual(["mesh1"]);

    // The owned mesh references the geometry whose stored AABB bounds the
    // (untransformed) source quad — i.e. the object's geometry encloses its
    // vertices. (SceneObject/SceneMesh expose no world-space aabb getter, so
    // we verify enclosure against the geometry boundary directly.)
    const geomAabb = Array.from(obj.meshes[0].geometry.aabb!);
    for (let i = 0; i < QUAD_POSITIONS.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        expect(QUAD_POSITIONS[i + k]).toBeGreaterThanOrEqual(geomAabb[k]);
        expect(QUAD_POSITIONS[i + k]).toBeLessThanOrEqual(geomAabb[k + 3]);
      }
    }
  });

  it("preserves originalSystemId through toParams", () => {
    const model = buildModel(new Scene(), "sourceIds");
    model.objects["Object1"].destroy();
    const result = model.createObject({
      id: "Object1",
      originalSystemId: "ifc-guid-123",
      meshIds: ["mesh1"],
    });
    expect(result.ok).toBe(true);

    const objParams = result.value!.toParams().value!;

    expect(objParams.id).toBe("Object1");
    expect(objParams.originalSystemId).toBe("ifc-guid-123");
    expect(objParams.meshIds).toEqual(["mesh1"]);
  });
});

describe("SceneMaterial", () => {

  it("color / opacity / emissiveColor getters reflect what was set", () => {
    const model = buildModel(new Scene(), "matModel");
    const mat = model.materials["m1"];

    // Colors are stored as Float32, so compare with float tolerance.
    expect(mat.color[0]).toBeCloseTo(0.2, 5);
    expect(mat.color[1]).toBeCloseTo(0.4, 5);
    expect(mat.color[2]).toBeCloseTo(0.6, 5);
    expect(mat.opacity).toBe(0.5);
    expect(mat.emissiveColor[0]).toBeCloseTo(0.1, 5);
    expect(mat.emissiveColor[1]).toBeCloseTo(0.2, 5);
    expect(mat.emissiveColor[2]).toBeCloseTo(0.3, 5);

    // Setters update the getters.
    mat.opacity = 0.25;
    expect(mat.opacity).toBe(0.25);
    mat.color = [0, 1, 0];
    expect(Array.from(mat.color)).toEqual([0, 1, 0]);

    // The mesh inherits the material's effective color/opacity over its own.
    const mesh = model.meshes["mesh1"];
    expect(Array.from(mesh.effectiveColor)).toEqual([0, 1, 0]);
    expect(mesh.effectiveOpacity).toBe(0.25);
  });

  it("serializes alpha and material pattern fields to params", () => {
    const model = new Scene().createModel({id: "matParams"}).value!;
    const hatchPattern = {
      families: [{angle: 45, spacing: 8, lineWidth: 1}],
      color: [0.1, 0.2, 0.3],
      opacity: 0.75,
      space: "world" as const,
    };
    const result = model.createMaterial({
      id: "m",
      alphaMode: "MASK",
      alphaCutoff: 0.25,
      linePattern: [3, 1],
      hatchPattern,
    });
    expect(result.ok).toBe(true);

    const params = result.value!.toParams().value!;

    expect(params.alphaMode).toBe("MASK");
    expect(params.alphaCutoff).toBe(0.25);
    expect(params.linePattern).toEqual([3, 1]);
    expect(params.hatchPattern).toEqual(hatchPattern);
  });
});

describe("SceneTexture", () => {

  it("serializes preloadColor as an independent plain array", () => {
    const model = new Scene().createModel({id: "textureParams"}).value!;
    const result = model.createTexture({
      id: "t",
      src: "texture.png",
      preloadColor: [0.1, 0.2, 0.3, 0.4],
    });
    expect(result.ok).toBe(true);

    const texture = result.value!;
    const params = texture.toParams().value!;

    expect(Array.isArray(params.preloadColor)).toBe(true);
    expect(params.preloadColor).toEqual([0.1, 0.2, 0.3, 0.4]);
    (params.preloadColor as number[])[0] = 1;
    expect(texture.preloadColor[0]).toBe(0.1);
  });

  it("rejects toParams after destroy", () => {
    const model = new Scene().createModel({id: "destroyedTextureParams"}).value!;
    const result = model.createTexture({id: "t", src: "texture.png"});
    expect(result.ok).toBe(true);
    const texture = result.value!;
    expect(texture.destroy().ok).toBe(true);

    const params = texture.toParams();

    expect(params.ok).toBe(false);
    if (!params.ok) {
      expect(params.error).toContain("destroyed SceneTexture");
    }
  });
});
