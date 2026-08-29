---
title: Export an Authored SceneModel to XGF
---

# Export an Authored SceneModel to XGF

This tutorial shows how to persist a programmatically authored `SceneModel` as
XGF, then load it back into a viewer. The earlier authoring tutorials build
models in memory; this one turns that authored content into deployable runtime
assets.

The important split is:

- XGF stores the visual model: geometry, transforms, meshes, materials, textures
  and `SceneObject` to mesh structure.
- DataModel JSON stores semantic data: `DataObject`s, property sets and
  relationships.
- `XGFExporter` writes a `SceneModel` to binary XGF.
- `DataModelExporter` writes a `DataModel` to a JSON-serializable
  `DataModelParams` object.
- `XGFLoader` and `DataModelImporter` load those assets back into runtime
  `SceneModel` and `DataModel` instances.

Keep XGF and DataModel JSON as separate files. Many viewers only need the XGF
geometry path. Applications that need object trees, property panels, search or
domain relationships can load the matching DataModel JSON alongside it.

[![House plan loaded from XGF](https://xeokit.github.io/sdk/examples/import/xgf/house-plan-pbr/index.png)](https://xeokit.github.io/sdk/examples/index.html#import/xgf/house-plan-pbr)

The live
[XGF House Plan](https://xeokit.github.io/sdk/examples/index.html#import/xgf/house-plan-pbr)
example shows the runtime side of this workflow: prepared XGF content loaded
directly into a viewer.

---

## 1. Create an Authored Model

Create a `SceneModel` and, optionally, a matching `DataModel`. Use the same
model ID for both when they describe the same asset.

```javascript
import {mkdir, writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {DataModelExporter} from "@xeokit/sdk/formats/datamodel";
import {XGFExporter} from "@xeokit/sdk/formats/xgf";

const scene = new Scene();
const data = new Data();

const sceneModelResult = scene.createModel({
  id: "authored-building",
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
});

if (!sceneModelResult.ok) {
  throw new Error(sceneModelResult.error);
}

const dataModelResult = data.createModel({
  id: "authored-building",
  name: "Authored Building",
  schema: "ExampleBuilding/v1"
});

if (!dataModelResult.ok) {
  throw new Error(dataModelResult.error);
}

const sceneModel = sceneModelResult.value;
const dataModel = dataModelResult.value;
```

`memoryPolicy: "compact"` is a good fit for a model that is authored once and
then exported. It is a renderer allocation hint for finalized content, not a
file-format requirement.

---

## 2. Add Geometry, Meshes and Objects

Add a small building model. The same object IDs can be used in the
`SceneModel` and `DataModel`.

```javascript
const geometryResult = sceneModel.createGeometry({
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
});

if (!geometryResult.ok) {
  throw new Error(geometryResult.error);
}

function createBoxObject(params) {
  const meshId = `${params.id}-mesh`;

  const meshResult = sceneModel.createMesh({
    id: meshId,
    geometryId: "unitBox",
    color: params.color,
    opacity: params.opacity,
    position: params.position,
    scale: params.scale
  });

  if (!meshResult.ok) {
    throw new Error(meshResult.error);
  }

  const objectResult = sceneModel.createObject({
    id: params.id,
    meshIds: [meshId],
    layerId: params.layerId
  });

  if (!objectResult.ok) {
    throw new Error(objectResult.error);
  }
}

createBoxObject({
  id: "building-01",
  layerId: "structure",
  color: [0.76, 0.78, 0.74],
  position: [0, 0, 1.2],
  scale: [4.5, 3.0, 2.4]
});

createBoxObject({
  id: "roof-01",
  layerId: "structure",
  color: [0.42, 0.42, 0.44],
  position: [0, 0, 2.52],
  scale: [4.8, 3.3, 0.24]
});

for (let bay = 0; bay < 4; bay++) {
  createBoxObject({
    id: `window-${bay}`,
    layerId: "facade",
    color: [0.16, 0.38, 0.62],
    opacity: 0.58,
    position: [-1.8 + bay * 1.2, -1.54, 1.25],
    scale: [0.58, 0.08, 0.45]
  });
}
```

XGF will store these geometries, meshes, materials or mesh-local colors,
transforms and object definitions.

---

## 3. Add Optional Semantics

Create semantic data only when your runtime needs it. Use matching IDs so
application code can move directly from a picked `SceneObject` to its
`DataObject`.

```javascript
const propertySetResult = dataModel.createPropertySet({
  id: "pset-building-01",
  name: "Building Common",
  type: "PropertySet",
  properties: [
    {
      name: "Reference",
      value: "A-100",
      valueType: "string"
    },
    {
      name: "GrossFloorArea",
      value: 128.5,
      valueType: "number"
    }
  ]
});

if (!propertySetResult.ok) {
  throw new Error(propertySetResult.error);
}

const buildingObjectResult = dataModel.createObject({
  id: "building-01",
  type: "Building",
  name: "Building 01",
  propertySetIds: ["pset-building-01"]
});

if (!buildingObjectResult.ok) {
  throw new Error(buildingObjectResult.error);
}

const roofObjectResult = dataModel.createObject({
  id: "roof-01",
  type: "Roof",
  name: "Roof 01"
});

if (!roofObjectResult.ok) {
  throw new Error(roofObjectResult.error);
}

const relationshipResult = dataModel.createRelationship({
  type: "Aggregates",
  relatingObjectId: "building-01",
  relatedObjectId: "roof-01"
});

if (!relationshipResult.ok) {
  throw new Error(relationshipResult.error);
}
```

The DataModel is not embedded in the XGF file. Export it separately when you
need semantic runtime features.

---

## 4. Seal the SceneModel

Seal the model after construction when no more topology or resources should be
added.

```javascript
const sealResult = sceneModel.seal();

if (!sealResult.ok) {
  throw new Error(sealResult.error);
}
```

Sealing is not required just to call `XGFExporter`, but it is a clear lifecycle
boundary for finalized generated content. It also prevents accidental late
changes after the model has become an export artifact.

---

## 5. Export Files in Node

Use `XGFExporter` for binary XGF and `DataModelExporter` for semantic JSON:

```javascript
async function exportAuthoredModel({
  sceneModel,
  dataModel,
  outputDir
}) {
  const xgfArrayBuffer = await new XGFExporter().write({
    sceneModel
  });

  const dataModelParams = await new DataModelExporter().write({
    dataModel
  });

  await writeBinaryFile(`${outputDir}/model.xgf`, xgfArrayBuffer);
  await writeTextFile(
    `${outputDir}/datamodel.json`,
    JSON.stringify(dataModelParams, null, 2)
  );
}

async function writeBinaryFile(filePath, arrayBuffer) {
  await mkdir(dirname(filePath), {recursive: true});
  await writeFile(filePath, Buffer.from(arrayBuffer));
}

async function writeTextFile(filePath, text) {
  await mkdir(dirname(filePath), {recursive: true});
  await writeFile(filePath, text, "utf8");
}

await exportAuthoredModel({
  sceneModel,
  dataModel,
  outputDir: "./public/models/authored-building"
});
```

The output directory now contains deployable runtime assets:

```text
public/models/authored-building/model.xgf
public/models/authored-building/datamodel.json
```

`XGFExporter` writes the current XGF version by default. Pass `version` only
when you need a specific compatibility target.

---

## 6. Create Browser Downloads

In a browser tool, convert the outputs to downloadable blobs instead of writing
to the filesystem:

```javascript
async function downloadAuthoredModel(sceneModel, dataModel) {
  const xgfArrayBuffer = await new XGFExporter().write({
    sceneModel
  });

  const dataModelParams = await new DataModelExporter().write({
    dataModel
  });

  downloadBlob("model.xgf", new Blob([xgfArrayBuffer]));
  downloadBlob(
    "datamodel.json",
    new Blob([JSON.stringify(dataModelParams, null, 2)], {
      type: "application/json"
    })
  );
}

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
```

This pattern is useful for authoring tools, prototype editors and test pages
that let users generate a model in the browser.

---

## 7. Load the Exported XGF

Load the exported assets into fresh runtime containers:

```javascript
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";

const scene = new Scene();
const data = new Data();
const viewer = new Viewer({scene});

const viewResult = viewer.createView({
  id: "main",
  htmlElement: document.getElementById("viewerCanvas"),
  backgroundColor: [0.93, 0.95, 0.98],
  camera: {
    eye: [8, -10, 6],
    look: [0, 0, 1.2],
    up: [0, 0, 1]
  }
});

if (!viewResult.ok) {
  throw new Error(viewResult.error);
}

const view = viewResult.value;
new WebGLRenderer({viewer});
new ModelNavigationController(view);

const sceneModelResult = scene.createModel({
  id: "authored-building"
});

if (!sceneModelResult.ok) {
  throw new Error(sceneModelResult.error);
}

const dataModelResult = data.createModel({
  id: "authored-building"
});

if (!dataModelResult.ok) {
  throw new Error(dataModelResult.error);
}

const [xgfArrayBuffer, dataModelParams] = await Promise.all([
  fetch("./models/authored-building/model.xgf").then((response) => response.arrayBuffer()),
  fetch("./models/authored-building/datamodel.json").then((response) => response.json())
]);

await new XGFLoader().load({
  fileData: xgfArrayBuffer,
  sceneModel: sceneModelResult.value
});

await new DataModelImporter().load({
  fileData: dataModelParams,
  dataModel: dataModelResult.value
});
```

The XGF load recreates the visual model. The DataModel load recreates the
semantic graph. Matching object IDs let picking and view state connect back to
semantic properties.

---

## 8. Export XGF or Stream XGF?

Use a single XGF file when the model is reasonably sized and can be loaded as
one asset. This is the simplest runtime deployment shape.

Use streamed XGF datasets when the model is too large to load all at once, or
when you need prioritised loading around the current camera. Streaming splits
content into chunks, index files and runtime scheduling. A normal XGF export is
still the right primitive for compact whole-model assets and for each visual
payload inside higher-level streaming workflows.

---

## 9. Rules of Thumb

Export `SceneModel` and `DataModel` separately. XGF is visual; DataModel JSON is
semantic.

Use stable matching IDs for `SceneObject`s and `DataObject`s when they represent
the same logical object.

Seal finalized authored models before export when they should no longer accept
new topology.

Write XGF as binary data. Write DataModel JSON as text.

Load DataModel JSON only when the application needs semantic features.

Use streamed XGF datasets for very large models or camera-prioritised loading.
Use a single XGF file for compact whole-model deployment.
