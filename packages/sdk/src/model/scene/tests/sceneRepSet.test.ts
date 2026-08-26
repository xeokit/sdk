import {TrianglesPrimitive} from "../../../base/constants";
import {Scene, type SceneModel, type SceneObject} from "../index";

describe("SceneModel representation sets", () => {
  it("creates and looks up a representation set with many-object and one-object representations", () => {
    const {model} = createTableModel();

    const result = model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      reps: [
        {
          id: "detailed",
          objectIds: ["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop"]
        },
        {
          id: "shell",
          objectIds: ["tableShell"]
        }
      ]
    });

    expect(result.ok).toBe(true);
    const repSet = result.value!;
    expect(model.repSets.table).toBe(repSet);
    expect(repSet.defaultRepId).toBe("detailed");
    expect(repSet.defaultRep).toBe(repSet.reps.detailed);
    expect(repSet.reps.detailed.objectIds).toEqual(["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop"]);
    expect(repSet.reps.shell.objectIds).toEqual(["tableShell"]);
    expect(model.getRepSetsForObject("redLeg")).toEqual([repSet]);
    expect(model.getRepSetsForObject("tableShell")).toEqual([repSet]);
  });

  it("stores optional projected-size selection metadata", () => {
    const {model} = createTableModel();

    const result = model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      selection: {
        strategy: "projectedSize",
        hysteresisPixels: 16
      },
      reps: [
        {
          id: "detailed",
          objectIds: ["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop"],
          range: {
            minPixels: 120
          }
        },
        {
          id: "shell",
          objectIds: ["tableShell"],
          range: {
            maxPixels: 100
          }
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.value!.selection).toEqual({strategy: "projectedSize", hysteresisPixels: 16});
    expect(result.value!.reps.detailed.range).toEqual({minPixels: 120});
    expect(result.value!.reps.shell.range).toEqual({maxPixels: 100});
  });

  it("supports multiple representation sets in one SceneModel and reverse lookup by object ID", () => {
    const {model} = createTableModel();
    addObject(model, "chairDetailed");
    addObject(model, "chairShell");

    const table = model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      reps: [
        {id: "detailed", objectIds: ["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop"]},
        {id: "shell", objectIds: ["tableShell"]}
      ]
    }).value!;
    const chair = model.createRepSet({
      id: "chair",
      defaultRepId: "full",
      reps: [
        {id: "full", objectIds: ["chairDetailed"]},
        {id: "proxy", objectIds: ["chairShell"]}
      ]
    }).value!;

    expect(Object.keys(model.repSets).sort()).toEqual(["chair", "table"]);
    expect(model.getRepSetsForObject("tableShell")).toEqual([table]);
    expect(model.getRepSetsForObject("chairShell")).toEqual([chair]);
  });

  it("rejects duplicate IDs, missing object references, invalid defaults and empty default representations", () => {
    const {model} = createTableModel();
    expect(model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      reps: [{id: "detailed", objectIds: ["redLeg"]}]
    }).ok).toBe(true);

    expect(model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      reps: [{id: "detailed", objectIds: ["redLeg"]}]
    }).ok).toBe(false);
    expect(model.createRepSet({
      id: "missingObject",
      defaultRepId: "detailed",
      reps: [{id: "detailed", objectIds: ["doesNotExist"]}]
    }).ok).toBe(false);
    expect(model.createRepSet({
      id: "badDefault",
      defaultRepId: "notHere",
      reps: [{id: "detailed", objectIds: ["redLeg"]}]
    }).ok).toBe(false);
    expect(model.createRepSet({
      id: "duplicateRep",
      defaultRepId: "detailed",
      reps: [
        {id: "detailed", objectIds: ["redLeg"]},
        {id: "detailed", objectIds: ["greenLeg"]}
      ]
    }).ok).toBe(false);
    expect(model.createRepSet({
      id: "emptyRep",
      defaultRepId: "empty",
      reps: [{id: "empty", objectIds: []}]
    }).ok).toBe(false);
  });

  it("allows empty non-default representations for selection states that hide detail-only content", () => {
    const {model} = createTableModel();

    const result = model.createRepSet({
      id: "detailOnly",
      defaultRepId: "all",
      selection: {strategy: "projectedSize"},
      reps: [
        {id: "all", objectIds: ["redLeg"], range: {minPixels: 100}},
        {id: "dominant", objectIds: [], range: {maxPixels: 100}}
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.value!.reps.dominant.objectIds).toEqual([]);
    expect(model.getRepSetsForObject("redLeg")).toEqual([result.value]);
  });

  it("rejects malformed projected-size ranges", () => {
    const {model} = createTableModel();

    expect(model.createRepSet({
      id: "negativeMin",
      defaultRepId: "detailed",
      reps: [{id: "detailed", objectIds: ["redLeg"], range: {minPixels: -1}}]
    }).ok).toBe(false);
    expect(model.createRepSet({
      id: "negativeMax",
      defaultRepId: "detailed",
      reps: [{id: "detailed", objectIds: ["redLeg"], range: {maxPixels: -1}}]
    }).ok).toBe(false);
    expect(model.createRepSet({
      id: "contradictory",
      defaultRepId: "detailed",
      reps: [{id: "detailed", objectIds: ["redLeg"], range: {minPixels: 200, maxPixels: 100}}]
    }).ok).toBe(false);
  });

  it("destroys representation sets without destroying referenced SceneObjects", () => {
    const {model} = createTableModel();
    const repSet = model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      reps: [
        {id: "detailed", objectIds: ["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop"]},
        {id: "shell", objectIds: ["tableShell"]}
      ]
    }).value!;

    expect(repSet.destroy().ok).toBe(true);

    expect(repSet.destroyed).toBe(true);
    expect(model.repSets.table).toBeUndefined();
    expect(model.objects.redLeg).toBeDefined();
    expect(model.objects.tableShell).toBeDefined();
    expect(model.getRepSetsForObject("redLeg")).toEqual([]);
  });

  it("destroys referencing representation sets when a referenced SceneObject is destroyed", () => {
    const {model, objects} = createTableModel();
    const repSet = model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      reps: [
        {id: "detailed", objectIds: ["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop"]},
        {id: "shell", objectIds: ["tableShell"]}
      ]
    }).value!;

    expect(objects.redLeg.destroy().ok).toBe(true);

    expect(repSet.destroyed).toBe(true);
    expect(model.repSets.table).toBeUndefined();
    expect(model.getRepSetsForObject("greenLeg")).toEqual([]);
    expect(model.objects.greenLeg).toBeDefined();
  });

  it("emits representation set lifecycle events", () => {
    const {scene, model} = createTableModel();
    const created: string[] = [];
    const destroyed: string[] = [];
    scene.events.onSceneRepSetCreated.subscribe((_model, repSet) => created.push(repSet.id));
    scene.events.onSceneRepSetDestroyed.subscribe((_model, repSet) => destroyed.push(repSet.id));

    const repSet = model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      reps: [
        {id: "detailed", objectIds: ["redLeg"]},
        {id: "shell", objectIds: ["tableShell"]}
      ]
    }).value!;
    repSet.destroy();

    expect(created).toEqual(["table"]);
    expect(destroyed).toEqual(["table"]);
  });

  it("round-trips representation sets through SceneModelParams", () => {
    const {model} = createTableModel();
    model.createRepSet({
      id: "table",
      defaultRepId: "detailed",
      selection: {strategy: "projectedSize", hysteresisPixels: 8},
      reps: [
        {id: "detailed", objectIds: ["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop"], range: {minPixels: 120}},
        {id: "shell", objectIds: ["tableShell"], range: {maxPixels: 100}}
      ]
    });

    const params = model.toParams().value!;
    const rebuiltScene = new Scene();
    const rebuilt = rebuiltScene.createModel({id: "rebuilt"}).value!;
    expect(rebuilt.fromParams({...params, id: "rebuilt"}).ok).toBe(true);

    expect(rebuilt.repSets.table.defaultRepId).toBe("detailed");
    expect(rebuilt.repSets.table.selection).toEqual({strategy: "projectedSize", hysteresisPixels: 8});
    expect(rebuilt.repSets.table.reps.shell.objectIds).toEqual(["tableShell"]);
  });
});

function createTableModel(): {scene: Scene; model: SceneModel; objects: {[id: string]: SceneObject}} {
  const scene = new Scene();
  const model = scene.createModel({id: "furniture"}).value!;
  const objects: {[id: string]: SceneObject} = {};
  for (const id of ["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop", "tableShell"]) {
    objects[id] = addObject(model, id);
  }
  return {scene, model, objects};
}

function addObject(model: SceneModel, id: string): SceneObject {
  expect(model.createGeometry({
    id: `${id}-geometry`,
    primitive: TrianglesPrimitive,
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2]
  }).ok).toBe(true);
  expect(model.createMesh({
    id: `${id}-mesh`,
    geometryId: `${id}-geometry`
  }).ok).toBe(true);
  const result = model.createObject({
    id,
    meshIds: [`${id}-mesh`]
  });
  expect(result.ok).toBe(true);
  return result.value!;
}
