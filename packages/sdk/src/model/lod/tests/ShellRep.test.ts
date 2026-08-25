import {TrianglesPrimitive} from "../../../base/constants";
import {Scene, type SceneModel, type SceneObject} from "../../scene";
import {createShellRep, type ShellGenerationParams, type ShellGeneratorResult} from "../index";

class StaticShellGenerator {
  generate(_sceneObjects: readonly SceneObject[], _params: ShellGenerationParams = {}): ShellGeneratorResult {
    return {
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
      indices: [0, 1, 2],
      center: [20, 30, 40],
      radius: 3,
      aabb: [-1, -1, 0, 1, 1, 0],
      stats: {
        sourceObjectCount: 2,
        sourceTriangleCount: 24,
        sourceVertexCount: 16,
        voxelCount: 8,
        occupiedVoxelCount: 4,
        shellVertexCount: 3,
        shellTriangleCount: 1,
        triangleReductionRatio: 24,
        gridDimensions: [2, 2, 2],
        generationTimeMs: 0
      }
    };
  }
}

describe("createShellRep", () => {
  it("creates shell resources and a representation set in the source SceneModel", () => {
    const model = new Scene().createModel({id: "terminal"}).value!;
    addBoxObject(model, "concourse", [-6, -2, 0], [6, 2, 3]);
    addBoxObject(model, "canopy", [-7, -3, 3], [7, 3, 5]);

    const result = createShellRep({
      model,
      id: "terminal-lod",
      objectIds: ["concourse", "canopy"],
      generator: new StaticShellGenerator() as any,
      selection: {
        strategy: "projectedSize",
        hysteresisPixels: 12
      },
      detailedRange: {
        minPixels: 160
      },
      shellRange: {
        maxPixels: 120
      }
    });

    expect(result.ok).toBe(true);
    const value = result.value!;
    expect(value.object.model).toBe(model);
    expect(value.mesh.matrix[12]).toBe(20);
    expect(value.mesh.matrix[13]).toBe(30);
    expect(value.mesh.matrix[14]).toBe(40);
    expect(model.repSets["terminal-lod"]).toBe(value.repSet);
    expect(value.repSet.defaultRepId).toBe("detailed");
    expect(value.repSet.selection).toEqual({strategy: "projectedSize", hysteresisPixels: 12});
    expect(value.repSet.reps.detailed.objectIds).toEqual(["concourse", "canopy"]);
    expect(value.repSet.reps.detailed.range).toEqual({minPixels: 160});
    expect(value.repSet.reps.shell.objectIds).toEqual([value.object.id]);
    expect(value.repSet.reps.shell.range).toEqual({maxPixels: 120});
    expect(model.getRepSetsForObject(value.object.id)).toEqual([value.repSet]);
  });

  it("does not leave shell resources behind when representation creation fails", () => {
    const model = new Scene().createModel({id: "terminal"}).value!;
    addBoxObject(model, "concourse", [-1, -1, -1], [1, 1, 1]);
    model.createRepSet({
      id: "existing",
      defaultRepId: "detailed",
      reps: [{id: "detailed", objectIds: ["concourse"]}]
    });

    const result = createShellRep({
      model,
      id: "new",
      objectIds: ["concourse"],
      generator: new StaticShellGenerator() as any,
      shellObjectId: "concourse"
    });

    expect(result.ok).toBe(false);
    expect(Object.keys(model.objects)).toEqual(["concourse"]);
    expect(Object.keys(model.meshes)).toEqual(["concourse-mesh"]);
    expect(Object.keys(model.geometries)).toEqual(["concourse-geometry"]);
  });
});

function addBoxObject(
  model: SceneModel,
  id: string,
  min: [number, number, number],
  max: [number, number, number]
): SceneObject {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  expect(model.createGeometry({
    id: `${id}-geometry`,
    primitive: TrianglesPrimitive,
    positions: [
      x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
      x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1
    ],
    indices: [
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      1, 2, 6, 1, 6, 5,
      2, 3, 7, 2, 7, 6,
      3, 0, 4, 3, 4, 7
    ]
  }).ok).toBe(true);
  expect(model.createMesh({
    id: `${id}-mesh`,
    geometryId: `${id}-geometry`
  }).ok).toBe(true);
  const objectResult = model.createObject({
    id,
    meshIds: [`${id}-mesh`]
  });
  expect(objectResult.ok).toBe(true);
  return objectResult.value!;
}
