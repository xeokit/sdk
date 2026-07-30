import {Scene} from "../../../scene";
import {TreeGenerator} from "../TreeGenerator";

describe("TreeGenerator", () => {
  it("generates shared geometry, meshes and one object per mesh", () => {
    const scene = new Scene();
    const sceneModel = scene.createModel({id: "tree"}).value!;
    const generator = new TreeGenerator();

    const stats = generator.generate(sceneModel, {
      species: "oak",
      seed: 7,
      height: 5,
      levels: 2,
      spread: 0.6,
      density: 0.6,
      leafSize: 0.45,
      trunkRadius: 0.2,
      branchRings: 2,
      ringBranches: 2
    });

    expect(stats.branches).toBeGreaterThan(0);
    expect(stats.leaves).toBeGreaterThan(0);
    expect(stats.meshes).toBe(stats.branches + stats.leaves + 1);
    expect(sceneModel.stats.numGeometries).toBe(3);
    expect(sceneModel.stats.numMeshes).toBe(stats.meshes);
    expect(sceneModel.stats.numObjects).toBe(stats.meshes);
  });

  it("can reuse branch and foliage geometries across positioned trees", () => {
    const scene = new Scene();
    const sceneModel = scene.createModel({id: "forest"}).value!;
    const generator = new TreeGenerator();

    const first = generator.generate(sceneModel, {
      idPrefix: "treeA_",
      geometryIdPrefix: "forest_",
      includeGround: false,
      seed: 11,
      height: 4,
      levels: 2,
      spread: 0.5,
      density: 0.45,
      leafSize: 0.35,
      trunkRadius: 0.18,
      branchRings: 2,
      ringBranches: 2,
      position: [0, 0, 0],
      rotation: 0.2,
      scale: 0.9
    });

    const second = generator.generate(sceneModel, {
      idPrefix: "treeB_",
      geometryIdPrefix: "forest_",
      includeGround: false,
      seed: 19,
      height: 4,
      levels: 2,
      spread: 0.5,
      density: 0.45,
      leafSize: 0.35,
      trunkRadius: 0.18,
      branchRings: 2,
      ringBranches: 2,
      position: [8, 0, 0],
      rotation: 1.1,
      scale: 1.1
    });

    expect(sceneModel.stats.numGeometries).toBe(2);
    expect(sceneModel.stats.numMeshes).toBe(first.meshes + second.meshes);
    expect(sceneModel.stats.numObjects).toBe(first.meshes + second.meshes);
    expect(sceneModel.objects["treeA_object_0"]).toBeDefined();
    expect(sceneModel.objects["treeB_object_0"]).toBeDefined();
  });
});
