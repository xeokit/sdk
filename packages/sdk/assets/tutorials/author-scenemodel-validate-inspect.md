---
title: Validate and Inspect Authored SceneModels
---

# Validate and Inspect Authored SceneModels

This tutorial shows how to check a programmatically authored `SceneModel`
before you hand it to a viewer, exporter or streaming pipeline.

Authoring code has two different kinds of correctness to think about:

- **Immediate validation** happens while you call creation methods such as
  `createGeometry`, `createMesh` and `createObject`. These methods return
  `SDKResult` values. Check them at the call site, because this catches missing
  IDs, duplicate IDs, invalid arrays, broken references and unsupported
  primitive combinations at the point where the bad data is introduced.
- **Inspection** happens after content exists in the model. The scene-model
  inspector walks the authored model and returns an `InspectionReport` with
  errors, warnings, info records and per-code buckets. Use it for structural
  checks, geometry-health checks and performance-budget checks.
- **Round-trip validation** exports the authored model and loads it again. This
  confirms that the content is not only valid in memory, but also survives the
  file format path you plan to deploy.

Use all three layers in build scripts and tests. Immediate validation gives
precise failure points, inspection gives model-level diagnostics, and a
round-trip catches mismatches between authoring code and runtime assets.

[![Scene model health inspection example](https://xeokit.github.io/sdk/examples/studio/inspect/scene/inspector/index.png)](https://xeokit.github.io/sdk/examples/index.html#studio/inspect/scene/inspector)

The live
[Scene Model Health Inspection](https://xeokit.github.io/sdk/examples/index.html#studio/inspect/scene/inspector)
example opens the scene-health tooling used to inspect model structure and
optimization issues.

---

## 1. Set Up a Checked Authoring Script

Import the scene, data, quality and file-format APIs used by this tutorial.

```javascript
import {mkdir, writeFile} from "node:fs/promises";
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {DataModelExporter, DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {XGFExporter, XGFLoader} from "@xeokit/sdk/formats/xgf";
import {
  inspectSceneModel,
  inspectionReportToJson
} from "@xeokit/sdk/quality/sceneModel";

function valueFrom(result, operation) {
  if (!result.ok) {
    throw new Error(`${operation}: ${result.error}`);
  }
  return result.value;
}
```

`valueFrom` keeps examples readable while still checking every `SDKResult`.
In production code, include enough context in the operation string to identify
the source object or loader record that failed.

---

## 2. Author a Small Model with Known Counts

Create a visual `SceneModel` and a semantic `DataModel` with the same model ID.
The shared ID is not required by the SDK, but it keeps exported assets easy to
pair later.

```javascript
const scene = new Scene();
const data = new Data();

const sceneModel = valueFrom(scene.createModel({
  id: "checked-building",
  coordinateSystem: {
    basis: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ],
    origin: [0, 0, 0],
    units: "meters"
  },
  memoryPolicy: "compact"
}), "create SceneModel");

const dataModel = valueFrom(data.createModel({
  id: "checked-building",
  name: "Checked Building",
  schema: "ExampleBuilding/v1"
}), "create DataModel");
```

Add geometry, material, meshes and objects. Each creation result is checked
before the next object depends on it.

```javascript
valueFrom(sceneModel.createGeometry({
  id: "unitBox",
  primitive: TrianglesPrimitive,
  positions: [
    -0.5, -0.5, -0.5,
     0.5, -0.5, -0.5,
     0.5,  0.5, -0.5,
    -0.5,  0.5, -0.5,
    -0.5, -0.5,  0.5,
     0.5, -0.5,  0.5,
     0.5,  0.5,  0.5,
    -0.5,  0.5,  0.5
  ],
  indices: [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0
  ]
}), "create unitBox geometry");

valueFrom(sceneModel.createMaterial({
  id: "concrete",
  color: [0.72, 0.72, 0.68],
  roughness: 0.85,
  metallic: 0
}), "create concrete material");

function createBoxObject(id, type, position, scale) {
  const meshId = `${id}-mesh`;

  valueFrom(sceneModel.createMesh({
    id: meshId,
    geometryId: "unitBox",
    materialId: "concrete",
    position,
    scale
  }), `create mesh ${meshId}`);

  valueFrom(sceneModel.createObject({
    id,
    meshIds: [meshId]
  }), `create object ${id}`);

  valueFrom(dataModel.createObject({
    id,
    type,
    name: id
  }), `create data object ${id}`);
}

createBoxObject("wall-01", "Wall", [-2, 1.5, 0], [0.2, 3, 3]);
createBoxObject("wall-02", "Wall", [ 2, 1.5, 0], [0.2, 3, 3]);
createBoxObject("floor-01", "Slab", [0, 0, 0], [4, 0.2, 3]);
```

The most useful authoring-time checks are the ones closest to the data source.
For example, if you are generating the wall records from a CAD import, keep the
source record ID in the `operation` string so failures point back to that
record.

---

## 3. Check Cheap Model Statistics

`SceneModel.stats` and `DataModel.stats` are cheap sanity checks. They do not
replace structural inspection, but they catch incomplete generation quickly.

```javascript
function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

expectEqual(sceneModel.stats.numGeometries, 1, "geometry count");
expectEqual(sceneModel.stats.numMaterials, 1, "material count");
expectEqual(sceneModel.stats.numMeshes, 3, "mesh count");
expectEqual(sceneModel.stats.numObjects, 3, "scene object count");
expectEqual(sceneModel.stats.numTriangles, 12, "triangle count");

expectEqual(dataModel.stats.numObjects, 3, "data object count");
```

Statistics are especially useful in automated dataset generation. If a script
was expected to emit 10,000 spaces and it emits 0, you want that failure before
you spend time exporting or loading the asset.

---

## 4. Check Scene and Data Alignment

The visual model and semantic model are separate. If your application expects
every visible object to have semantic data, test that convention explicitly.

```javascript
function findSceneObjectsWithoutData(sceneModel, dataModel) {
  const missing = [];

  for (const objectId of Object.keys(sceneModel.objects)) {
    if (!dataModel.objects[objectId]) {
      missing.push(objectId);
    }
  }

  return missing;
}

const missingDataObjects = findSceneObjectsWithoutData(sceneModel, dataModel);

if (missingDataObjects.length > 0) {
  throw new Error(
    `Missing DataObjects for SceneObjects: ${missingDataObjects.join(", ")}`
  );
}
```

This is application policy, not a low-level renderer rule. Some visual helpers,
labels, overlays and construction guides deliberately have no semantic object.
Keep those conventions in one project-level validation function instead of
spreading one-off checks through authoring code.

---

## 5. Run the SceneModel Inspector

`inspectSceneModel` returns an `InspectionReport`. Built-in baseline checks run
by default, while heavier checks are opt-in so large generated models can choose
the cost they want to pay.

```javascript
const report = inspectSceneModel({
  sceneModel,
  checkGeometryQuality: true,
  checkDuplicateGeometries: true,
  checkDenseGeometries: true,
  checkGeometryArrayLengths: true,
  checkObjectStructure: true,
  maxVertices: 50000,
  maxPrimitives: 50000,
  maxOriginDistance: 100000
});

if (report.errors.length > 0) {
  throw new Error(
    report.errors.map((issue) => issue.message).join("\n")
  );
}

for (const warning of report.warnings) {
  console.warn(`${warning.code}: ${warning.message}`);
}
```

Treat errors as blockers. Treat warnings as budget and quality signals:
duplicate geometry may indicate missed instancing, dense geometry may need
splitting, and far-from-origin objects may need a model coordinate-system
strategy.

---

## 6. Write a JSON Inspection Report

For CI, convert the report to a plain JSON object and save it alongside the
generated model. The JSON includes counts, per-code aggregation and individual
issues.

```javascript
await mkdir("dist/checked-building", {recursive: true});

const reportJson = inspectionReportToJson(report);

await writeFile(
  "dist/checked-building/inspection-report.json",
  JSON.stringify(reportJson, null, 2)
);
```

Use this report as a stable build artifact. It lets model-generation jobs fail
on `counts.error > 0`, display warning trends over time, or publish the exact
resources that need authoring fixes.

---

## 7. Round-Trip Through XGF and DataModel JSON

Export the visual and semantic models, load them into fresh containers, then
check the important counts again.

```javascript
const xgfBuffer = await new XGFExporter().write({
  sceneModel
});

const dataModelParams = await new DataModelExporter().write({
  dataModel
});

await writeFile("dist/checked-building/model.xgf", Buffer.from(xgfBuffer));
await writeFile(
  "dist/checked-building/datamodel.json",
  JSON.stringify(dataModelParams, null, 2)
);

const loadedScene = new Scene();
const loadedData = new Data();

const loadedSceneModel = valueFrom(loadedScene.createModel({
  id: "checked-building-loaded"
}), "create loaded SceneModel");

const loadedDataModel = valueFrom(loadedData.createModel({
  id: "checked-building-loaded",
  schema: "ExampleBuilding/v1"
}), "create loaded DataModel");

await new XGFLoader().load({
  fileData: xgfBuffer,
  sceneModel: loadedSceneModel
});

await new DataModelImporter().load({
  fileData: dataModelParams,
  dataModel: loadedDataModel
});

expectEqual(
  loadedSceneModel.stats.numObjects,
  sceneModel.stats.numObjects,
  "round-trip scene object count"
);

expectEqual(
  loadedDataModel.stats.numObjects,
  dataModel.stats.numObjects,
  "round-trip data object count"
);
```

A round-trip does not prove visual intent, material quality or frame rate. It
does prove that the authored content can pass through the deployed asset path
without losing the basic structure you expect.

---

## 8. Use the Checks in a Build Step

Wrap the checks in the same script that authors the model:

```javascript
async function buildCheckedModel() {
  // Create SceneModel and DataModel.
  // Add geometry, materials, meshes, objects and semantic data.
  // Check stats and scene/data alignment.
  // Inspect the SceneModel.
  // Export and round-trip the deployable assets.
}

buildCheckedModel().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

For authored content, validation should be part of generation rather than a
manual viewer check. A viewer can tell you what the model looks like; the build
step should tell you whether the model is structurally valid, exportable and
consistent with the project conventions that downstream tools rely on.
