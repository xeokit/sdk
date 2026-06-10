// Drives the REAL Scene + SceneModel build lifecycle (no renderer).
import {Scene} from "../Scene";
import {TrianglesPrimitive} from "../../../base/constants";

// A unit quad (2 triangles) in the XY plane at z=0.
const QUAD_POSITIONS = [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];

// Builds a Scene with one fully-populated model: geometry -> mesh -> object.
// There is NO build()/finalize() step in this SDK — maps and the geometry
// AABB are populated synchronously by the create* calls.
function buildScene() {
  const scene = new Scene();
  const modelResult = scene.createModel({id: "model1"});
  expect(modelResult.ok).toBe(true);
  const model = modelResult.value!;

  expect(model.createGeometry({
    id: "geom1",
    primitive: TrianglesPrimitive,
    positions: QUAD_POSITIONS,
    indices: QUAD_INDICES,
  }).ok).toBe(true);

  expect(model.createMesh({
    id: "mesh1",
    geometryId: "geom1",
    color: [1, 0, 0],
    matrix: [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1],
  }).ok).toBe(true);

  expect(model.createObject({
    id: "object1",
    meshIds: ["mesh1"],
  }).ok).toBe(true);

  return {scene, model};
}

describe("Scene + SceneModel build lifecycle", () => {

  it("starts empty and registers a model via createModel", () => {
    const scene = new Scene();
    expect(Object.keys(scene.models)).toHaveLength(0);
    expect(Object.keys(scene.objects)).toHaveLength(0);

    const result = scene.createModel({id: "model1"});
    expect(result.ok).toBe(true);

    // No Scene.getModel() exists — models are retrieved from the map.
    expect(scene.models["model1"]).toBe(result.value);
    expect(scene.models["model1"].id).toBe("model1");
    expect(Object.keys(scene.models)).toHaveLength(1);
  });

  it("exposes created geometry/mesh/object in the model's maps", () => {
    const {scene, model} = buildScene();

    expect(model.geometries["geom1"]).toBeDefined();
    expect(model.geometries["geom1"].id).toBe("geom1");

    expect(model.meshes["mesh1"]).toBeDefined();
    expect(model.meshes["mesh1"].id).toBe("mesh1");
    // The mesh wired up to its geometry and carries the supplied color.
    expect(model.meshes["mesh1"].geometry).toBe(model.geometries["geom1"]);
    expect(Array.from(model.meshes["mesh1"].color)).toEqual([1, 0, 0]);

    expect(model.objects["object1"]).toBeDefined();
    expect(model.objects["object1"].id).toBe("object1");
    // createObject also registers the object at the Scene level.
    expect(scene.objects["object1"]).toBe(model.objects["object1"]);

    // Stats reflect the populated model.
    expect(model.stats.numGeometries).toBe(1);
    expect(model.stats.numMeshes).toBe(1);
    expect(model.stats.numObjects).toBe(1);
    expect(model.stats.numTriangles).toBe(2);
  });

  it("computes a geometry AABB that bounds the input positions", () => {
    const {model} = buildScene();

    // SceneModel/SceneObject/SceneMesh expose no world-space AABB getter in
    // this SDK; the computed boundary lives on SceneGeometry.aabb, derived
    // directly from the input positions by compressGeometryParams.
    const aabb = model.geometries["geom1"].aabb!;
    expect(aabb).toBeDefined();
    expect(aabb).toHaveLength(6);

    // Bounds the quad exactly: [minX,minY,minZ, maxX,maxY,maxZ].
    expect(aabb[0]).toBeCloseTo(0, 5);
    expect(aabb[1]).toBeCloseTo(0, 5);
    expect(aabb[2]).toBeCloseTo(0, 5);
    expect(aabb[3]).toBeCloseTo(1, 5);
    expect(aabb[4]).toBeCloseTo(1, 5);
    expect(aabb[5]).toBeCloseTo(0, 5); // flat quad — zero extent in z

    // Non-degenerate in the plane the quad actually spans.
    expect(aabb[3] - aabb[0]).toBeGreaterThan(0);
    expect(aabb[4] - aabb[1]).toBeGreaterThan(0);
  });

  it("fails to create a mesh referencing a missing geometry", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "model1"}).value!;

    // Failure contract: SDKResult {ok:false, error} — no throw, no partial mesh.
    const result = model.createMesh({id: "orphan", geometryId: "does-not-exist"});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("SceneGeometry not found");
    }
    expect(model.meshes["orphan"]).toBeUndefined();
  });

  it("removes a model from the Scene when the model is destroyed", () => {
    const {scene, model} = buildScene();
    expect(scene.models["model1"]).toBeDefined();
    expect(scene.objects["object1"]).toBeDefined();

    const result = model.destroy();
    expect(result.ok).toBe(true);

    // Model and its scene-level object are both gone.
    expect(scene.models["model1"]).toBeUndefined();
    expect(scene.objects["object1"]).toBeUndefined();
    expect(model.destroyed).toBe(true);
  });
});
