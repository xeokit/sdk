---
title: Convert IFC to XGF and DataModel JSON with Loaders and Exporters
---

# Convert IFC to XGF and DataModel JSON with Loaders and Exporters

This tutorial shows how to convert an IFC file into two xeokit runtime files
from JavaScript code:

- `model.xgf` for renderable geometry, materials, transforms and object-to-mesh
  structure.
- `datamodel.json` for BIM semantics: object types, relationships, property
  sets and other data used by object trees, property panels, search and
  inspection tools.

The conversion uses the SDK's format pipeline directly. An `IFCLoader` reads the
IFC STEP file into a `SceneModel` and a `DataModel`. An `XGFExporter` then writes
the `SceneModel` to XGF, while a `DataModelExporter` writes the `DataModel` to
JSON.

This is the programmatic version of an IFC-to-XGF conversion pipeline. Use it
when conversion is part of a custom build tool, upload workflow, batch job,
server-side preprocessing step, or test harness. The important architectural
point is that IFC is a source BIM exchange format, while XGF and DataModel JSON
are xeokit runtime assets. IFC loading does schema parsing and geometry
construction; exporting stores the prepared result so the browser viewer can
load compact files instead of parsing IFC every time.

The geometry and semantic data are deliberately written separately. Rendering
can load `model.xgf` quickly into a `SceneModel`, while application features can
load `datamodel.json` into a `DataModel` only when they need BIM semantics.

[![West Riverside Hospital loaded from XGF](https://xeokit.github.io/sdk/examples/import/xgf/west-river-side-hospital/index.png)](https://xeokit.github.io/sdk/examples/index.html#import/xgf/west-river-side-hospital)

The live
[XGF West Riverside Hospital](https://xeokit.github.io/sdk/examples/index.html#import/xgf/west-river-side-hospital)
example shows the runtime side of this workflow: a prepared XGF model loaded
directly into a browser viewer.

---

## 1. Create a Conversion Script

Create `convert-ifc-to-xgf.js` in your project:

```javascript
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {DataModelExporter} from "@xeokit/sdk/formats/datamodel";
import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {XGFExporter} from "@xeokit/sdk/formats/xgf";

const sourceIFC = process.argv[2];
const outputDir = process.argv[3] || "public/models/my-building";

if (!sourceIFC) {
  throw new Error("Usage: node convert-ifc-to-xgf.js ./source/model.ifc ./public/models/my-building");
}

await convertIFCToXGF({
  sourceIFC,
  xgfPath: `${outputDir}/model.xgf`,
  dataModelPath: `${outputDir}/datamodel.json`,
  modelId: "my-building"
});
```

This script accepts the source IFC path and output directory from the command
line. The same `modelId` is used for both the `SceneModel` and the `DataModel`,
which keeps the visual and semantic outputs aligned.

---

## 2. Load the IFC into SceneModel and DataModel

Add the conversion function:

```javascript
async function convertIFCToXGF({
  sourceIFC,
  xgfPath,
  dataModelPath,
  modelId
}) {
  const scene = new Scene();
  const data = new Data();

  const sceneModelResult = scene.createModel({
    id: modelId,
    memoryPolicy: "compact"
  });

  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const dataModelResult = data.createModel({
    id: modelId
  });

  if (!dataModelResult.ok) {
    throw new Error(dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;
  const ifcFileData = toArrayBuffer(await readFile(sourceIFC));

  await new IFCLoader().load(
    {
      fileData: ifcFileData,
      sceneModel,
      dataModel
    },
    {
      onProgress: ({phase, current, total}) => {
        if (phase) {
          console.log(`${phase}: ${current}/${total}`);
        }
      }
    }
  );

  const sealResult = sceneModel.seal();

  if (!sealResult.ok) {
    throw new Error(sealResult.error);
  }

  await exportConvertedFiles({
    sceneModel,
    dataModel,
    xgfPath,
    dataModelPath
  });
}
```

`IFCLoader` populates both targets:

- `sceneModel` receives renderable model components such as geometries, meshes,
  materials and objects.
- `dataModel` receives the semantic IFC graph: data objects, relationships and
  property sets.

The base loader manages the SceneModel `building` state during the load. That
lets attached renderers defer partial registrations while the IFC parser is
constructing the model. In a conversion script there is usually no attached
viewer, but the same loader path is used as in an interactive application.

The final `seal()` call marks the `SceneModel` complete. It is a useful signal
for finalized conversion output because no more topology or resources should be
added after export.

---

## 3. Export XGF and DataModel JSON

Add the export helper:

```javascript
async function exportConvertedFiles({
  sceneModel,
  dataModel,
  xgfPath,
  dataModelPath
}) {
  const xgfArrayBuffer = await new XGFExporter().write({
    sceneModel
  });

  const dataModelParams = await new DataModelExporter().write({
    dataModel
  });

  await writeBinaryFile(xgfPath, xgfArrayBuffer);
  await writeTextFile(dataModelPath, JSON.stringify(dataModelParams, null, 2));

  console.log(`Wrote ${xgfPath}`);
  console.log(`Wrote ${dataModelPath}`);
}

async function writeBinaryFile(filePath, arrayBuffer) {
  await mkdir(dirname(filePath), {recursive: true});
  await writeFile(filePath, Buffer.from(arrayBuffer));
}

async function writeTextFile(filePath, text) {
  await mkdir(dirname(filePath), {recursive: true});
  await writeFile(filePath, text, "utf8");
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}
```

`XGFExporter` writes binary `ArrayBuffer` data. `DataModelExporter` writes a
plain `DataModelParams` object, so stringify it when saving to disk.

---

## 4. Run the Conversion

Run the script with Node:

```bash
node convert-ifc-to-xgf.js ./source/model.ifc ./public/models/my-building
```

The output directory should contain:

```text
public/models/my-building/model.xgf
public/models/my-building/datamodel.json
```

Use stable output paths in production. Viewers, caches, manifests and tests can
then treat the XGF and DataModel JSON files as deployable runtime assets.

---

## 5. Load the Converted Files in a Viewer

The viewer loads the two files through their matching runtime importers:

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
    eye: [20, 20, 20],
    look: [0, 0, 0],
    up: [0, 0, 1]
  }
});

if (!viewResult.ok) {
  throw new Error(viewResult.error);
}

const view = viewResult.value;

new WebGLRenderer({viewer});
new ModelNavigationController(view);

const sceneModelResult = scene.createModel({id: "my-building"});

if (!sceneModelResult.ok) {
  throw new Error(sceneModelResult.error);
}

const dataModelResult = data.createModel({id: "my-building"});

if (!dataModelResult.ok) {
  throw new Error(dataModelResult.error);
}

const sceneModel = sceneModelResult.value;
const dataModel = dataModelResult.value;

await new XGFLoader().load({
  fileData: await fetchArrayBuffer("./models/my-building/model.xgf"),
  sceneModel
});

await new DataModelImporter().load({
  fileData: await fetchJSON("./models/my-building/datamodel.json"),
  dataModel
});

console.log("Scene objects:", Object.keys(scene.objects).length);
console.log("Data objects:", Object.keys(data.objects).length);

async function fetchArrayBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.arrayBuffer();
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}
```

XGF is geometry-focused. DataModel JSON is semantic-data-focused. Keeping the two
loads explicit makes it clear which systems need render data and which systems
need BIM data.

---

## 6. When to Use This Instead of the CLI

Use the programmatic loader/exporter path when conversion is part of your own
application logic. It gives you direct access to the populated `SceneModel` and
`DataModel` before export, so you can inspect, enrich, filter, validate or
partition the data.

Use the `xeoconvert` CLI when you want a ready-made command-line conversion
pipeline with inspection reports and fewer moving parts.

Both approaches produce the same kind of runtime assets: XGF for visual model
data and DataModel JSON for semantic model data.
