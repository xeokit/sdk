import {TrianglesPrimitive} from "../../../base/constants";
import {Scene} from "../../../model/scene";
import {optimizeSceneModel} from "../optimizeSceneModel";


const QUAD_POSITIONS = [
  0, 0, 0,
  1, 0, 0,
  1, 1, 0,
  0, 1, 0,
];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];
const MATRIX = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  7, 8, 9, 1];


describe("optimizeSceneModel", () => {

  it("preserves mesh visual fields when splitting oversized geometry", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createMaterial({
      id: "mat",
      color: [0.4, 0.5, 0.6],
    }).ok).toBe(true);
    expect(sceneModel.createTransform({
      id: "parent",
      matrix: [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  3, 0, 0, 1],
    }).ok).toBe(true);
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
    }).ok).toBe(true);
    expect(sceneModel.createMesh({
      id: "mesh",
      geometryId: "g",
      materialId: "mat",
      matrix: MATRIX as any,
      color: [0.1, 0.2, 0.3],
      opacity: 0.45,
      parentTransformId: "parent",
      bin: "overlay",
    }).ok).toBe(true);
    expect(sceneModel.createObject({
      id: "object",
      meshIds: ["mesh"],
    }).ok).toBe(true);

    const res = optimizeSceneModel({
      sceneModel,
      maxVertices: 3,
      maxPrimitives: 100,
    });

    expect(res.ok).toBe(true);
    expect(sceneModel.meshes["mesh"]).toBeUndefined();
    for (const id of ["mesh_a", "mesh_b"]) {
      const mesh = sceneModel.meshes[id];
      expect(mesh).toBeDefined();
      expect(mesh.materialId).toBe("mat");
      expect(mesh.color[0]).toBeCloseTo(0.1, 6);
      expect(mesh.color[1]).toBeCloseTo(0.2, 6);
      expect(mesh.color[2]).toBeCloseTo(0.3, 6);
      expect(mesh.opacity).toBe(0.45);
      expect(mesh.parentTransform?.id).toBe("parent");
      expect(mesh.bin).toBe("overlay");
      expect(Array.from(mesh.matrix)).toEqual(MATRIX);
    }
  });

  it("cleans up a replacement mesh when optimizer split rebuild fails", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createTransform({
      id: "parent",
      matrix: [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  3, 0, 0, 1],
    }).ok).toBe(true);
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
    }).ok).toBe(true);
    expect(sceneModel.createMesh({
      id: "mesh",
      geometryId: "g",
      parentTransformId: "parent",
    }).ok).toBe(true);
    expect(sceneModel.createObject({
      id: "object",
      meshIds: ["mesh"],
    }).ok).toBe(true);

    sceneModel.scene.events.onSceneObjectMeshAdded.subscribe((_object, mesh) => {
      if (mesh.id === "mesh_a") {
        sceneModel.transforms["parent"].destroy();
      }
    });

    const res = optimizeSceneModel({
      sceneModel,
      maxVertices: 3,
      maxPrimitives: 100,
    });

    expect(res.ok).toBe(false);
    expect(sceneModel.meshes["mesh_a"]).toBeUndefined();
    expect(sceneModel.objects["object"].meshes.map(mesh => mesh.id)).not.toContain("mesh_a");
  });
});
