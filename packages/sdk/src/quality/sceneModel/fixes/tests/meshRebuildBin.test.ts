import {LinesPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {Scene} from "../../../../model/scene";
import {mergeDuplicateGeometries} from "../mergeDuplicateGeometries";
import {mergeSimilarGeometries} from "../mergeSimilarGeometries";
import {splitGeometryAndRebuildMeshes} from "../../internal/splitGeometryAndRebuildMeshes";


const QUAD_POSITIONS = [
  0, 0, 0,
  1, 0, 0,
  1, 1, 0,
  0, 1, 0,
];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];


function model() {
  return new Scene().createModel({id: "m"}).value!;
}


function addQuadGeometry(sceneModel: ReturnType<typeof model>, id: string) {
  const res = sceneModel.createGeometry({
    id,
    primitive: TrianglesPrimitive,
    positions: QUAD_POSITIONS,
    indices: QUAD_INDICES,
  });
  expect(res.ok).toBe(true);
}


function addBinnedMesh(sceneModel: ReturnType<typeof model>, geometryId: string, meshId = "mesh") {
  expect(sceneModel.createMesh({
    id: meshId,
    geometryId,
    bin: "overlay",
  }).ok).toBe(true);
  expect(sceneModel.createObject({
    id: `${meshId}-object`,
    meshIds: [meshId],
  }).ok).toBe(true);
}


describe("mesh rebuild fixes", () => {

  it("preserves mesh bin when splitting geometry", () => {
    const m = model();
    addQuadGeometry(m, "g");
    addBinnedMesh(m, "g");

    const res = splitGeometryAndRebuildMeshes(m, "g");

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(m.meshes["mesh_a"].bin).toBe("overlay");
    expect(m.meshes["mesh_b"].bin).toBe("overlay");
  });

  it("cleans up a replacement mesh when restoring its parent transform fails", () => {
    const m = model();
    addQuadGeometry(m, "g");
    expect(m.createTransform({id: "parent"}).ok).toBe(true);
    expect(m.createMesh({
      id: "mesh",
      geometryId: "g",
      parentTransformId: "parent",
    }).ok).toBe(true);
    expect(m.createObject({
      id: "mesh-object",
      meshIds: ["mesh"],
    }).ok).toBe(true);

    m.scene.events.onSceneObjectMeshAdded.subscribe((_object, mesh) => {
      if (mesh.id === "mesh_a") {
        m.transforms["parent"].destroy();
      }
    });

    const res = splitGeometryAndRebuildMeshes(m, "g");

    expect(res.ok).toBe(false);
    expect(m.meshes["mesh_a"]).toBeUndefined();
    expect(m.objects["mesh-object"].meshes.map(mesh => mesh.id)).not.toContain("mesh_a");
  });

  it("declines to split non-triangle geometries", () => {
    const m = model();
    expect(m.createGeometry({
      id: "lines",
      primitive: LinesPrimitive,
      positions: [
        0, 0, 0,
        1, 0, 0,
        2, 0, 0,
        3, 0, 0,
        4, 0, 0,
        5, 0, 0,
      ],
      indices: [
        0, 1,
        2, 3,
        4, 5,
        0, 2,
        3, 5,
        1, 4,
      ],
    }).ok).toBe(true);
    addBinnedMesh(m, "lines");

    const res = splitGeometryAndRebuildMeshes(m, "lines");

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(false);
    expect((res as any).value.reason).toBe("precondition-failed");
    expect(m.geometries["lines"].destroyed).toBe(false);
    expect(m.geometries["lines_a"]).toBeUndefined();
    expect(m.geometries["lines_b"]).toBeUndefined();
    expect(m.meshes["mesh"].geometryId).toBe("lines");
  });

  it("preserves mesh bin when merging duplicate geometries", () => {
    const m = model();
    addQuadGeometry(m, "canonical");
    addQuadGeometry(m, "duplicate");
    addBinnedMesh(m, "duplicate");

    const res = mergeDuplicateGeometries.apply({
      resourceId: "canonical",
      context: {duplicates: ["duplicate"]},
    } as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(m.meshes["mesh"].geometryId).toBe("canonical");
    expect(m.meshes["mesh"].bin).toBe("overlay");
  });

  it("cleans up a replacement mesh when duplicate merge parent restoration fails", () => {
    const m = model();
    addQuadGeometry(m, "canonical");
    addQuadGeometry(m, "duplicate");
    expect(m.createTransform({id: "parent"}).ok).toBe(true);
    expect(m.createMesh({
      id: "mesh",
      geometryId: "duplicate",
      parentTransformId: "parent",
    }).ok).toBe(true);
    expect(m.createObject({
      id: "mesh-object",
      meshIds: ["mesh"],
    }).ok).toBe(true);

    m.scene.events.onSceneObjectMeshAdded.subscribe((_object, mesh) => {
      if (mesh.id === "mesh") {
        m.transforms["parent"].destroy();
      }
    });

    const res = mergeDuplicateGeometries.apply({
      resourceId: "canonical",
      context: {duplicates: ["duplicate"]},
    } as any, m as any);

    expect(res.ok).toBe(false);
    expect(m.meshes["mesh"]).toBeUndefined();
    expect(m.objects["mesh-object"].meshes.map(mesh => mesh.id)).not.toContain("mesh");
  });

  it("does not claim duplicate geometries were fixed when references prevent deletion", () => {
    const m = model();
    addQuadGeometry(m, "canonical");
    addQuadGeometry(m, "duplicate");
    expect(m.createMesh({
      id: "orphan",
      geometryId: "duplicate",
    }).ok).toBe(true);

    const res = mergeDuplicateGeometries.apply({
      resourceId: "canonical",
      context: {duplicates: ["duplicate"]},
    } as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(false);
    expect((res as any).value.reason).toBe("precondition-failed");
    expect(m.geometries["duplicate"].destroyed).toBe(false);
    expect(m.meshes["orphan"].geometryId).toBe("duplicate");
  });

  it("preserves mesh bin when merging similar geometries", () => {
    const m = model();
    addQuadGeometry(m, "canonical");
    addQuadGeometry(m, "similar");
    addBinnedMesh(m, "similar");

    const res = mergeSimilarGeometries.apply({
      resourceId: "canonical",
      context: {similar: ["similar"]},
    } as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(m.meshes["mesh"].geometryId).toBe("canonical");
    expect(m.meshes["mesh"].bin).toBe("overlay");
  });

  it("cleans up a replacement mesh when similar merge parent restoration fails", () => {
    const m = model();
    addQuadGeometry(m, "canonical");
    addQuadGeometry(m, "similar");
    expect(m.createTransform({id: "parent"}).ok).toBe(true);
    expect(m.createMesh({
      id: "mesh",
      geometryId: "similar",
      parentTransformId: "parent",
    }).ok).toBe(true);
    expect(m.createObject({
      id: "mesh-object",
      meshIds: ["mesh"],
    }).ok).toBe(true);

    m.scene.events.onSceneObjectMeshAdded.subscribe((_object, mesh) => {
      if (mesh.id === "mesh") {
        m.transforms["parent"].destroy();
      }
    });

    const res = mergeSimilarGeometries.apply({
      resourceId: "canonical",
      context: {similar: ["similar"]},
    } as any, m as any);

    expect(res.ok).toBe(false);
    expect(m.meshes["mesh"]).toBeUndefined();
    expect(m.objects["mesh-object"].meshes.map(mesh => mesh.id)).not.toContain("mesh");
  });
});
