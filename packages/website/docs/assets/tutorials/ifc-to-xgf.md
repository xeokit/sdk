---
title: Convert IFC to XGF and View It with xeokit V3
---

# Convert IFC to XGF and View It with xeokit V3

This tutorial converts an IFC model to xeokit's native XGF format with the
`xeoconvert` CLI, then loads the converted model in a browser with xeokit V3.

IFC is the source-of-truth BIM exchange format. It carries building elements,
semantic types, object IDs, relationships and property sets, but it is not shaped
for fast browser rendering. A viewer has to parse the IFC schema, tessellate
geometry, build render buffers and assemble BIM metadata before the model becomes
interactive.

XGF is xeokit's compact runtime geometry format. The conversion step does the
expensive parsing and geometry preparation ahead of time, then writes renderable
geometry that the browser can load directly into a `SceneModel`. The viewer no
longer needs to run the IFC pipeline on every page load.

The semantic BIM data is stored separately from the render geometry. That split
lets rendering stay small and fast while still preserving the data needed for
selection, search, properties panels, object trees and BIM workflows.

The conversion produces two files:

- `model.xgf` - compact renderable geometry and material data.
- `datamodel.json` - semantic BIM data in xeokit's `DataModelParams` JSON format.

Keeping these files side by side lets the viewer load the visual model quickly
while resolving IFC object IDs, types, relationships and properties into xeokit's
data model.

[![West Riverside Hospital loaded from XGF](https://xeokit.github.io/sdk/examples/import/xgf/west-river-side-hospital/index.png)](https://xeokit.github.io/sdk/examples/index.html#import/xgf/west-river-side-hospital)

The live
[XGF West Riverside Hospital](https://xeokit.github.io/sdk/examples/index.html#import/xgf/west-river-side-hospital)
example shows the kind of prepared runtime XGF model this conversion workflow
produces for browser loading.

---

## 1. Install the SDK

For an application project, install the SDK from npm:

```bash
npm install @xeokit/sdk
```

The package exposes the `xeoconvert` command:

```bash
npx xeoconvert --help
```

When working from this repository checkout, build the SDK and run the local CLI instead:

```bash
pnpm --filter @xeokit/sdk sdk-dist
node packages/sdk/dist/xeoconvert/xeoconvert.js --help
```

---

## 2. Convert IFC to XGF

Create an output directory for the converted model:

```bash
mkdir -p public/models/my-building
```

Run the `ifc2xgf` pipeline:

```bash
npx xeoconvert \
  --pipeline ifc2xgf \
  --ifc ./source/model.ifc \
  --xgf ./public/models/my-building/model.xgf \
  --datamodel ./public/models/my-building/datamodel.json \
  --inspect-fix \
  --inspect-checks all \
  --inspection-report ./public/models/my-building/inspection.json \
  --optimization-report ./public/models/my-building/optimization.json \
  --stats-report ./public/models/my-building/stats.json \
  --manifest-report ./public/models/my-building/manifest.json \
  --log
```

From this repository checkout, use the built CLI path:

```bash
node packages/sdk/dist/xeoconvert/xeoconvert.js \
  --pipeline ifc2xgf \
  --ifc ./source/model.ifc \
  --xgf ./public/models/my-building/model.xgf \
  --datamodel ./public/models/my-building/datamodel.json \
  --inspect-fix \
  --inspect-checks all \
  --inspection-report ./public/models/my-building/inspection.json \
  --optimization-report ./public/models/my-building/optimization.json \
  --stats-report ./public/models/my-building/stats.json \
  --manifest-report ./public/models/my-building/manifest.json \
  --log
```

The important arguments are:

- `--pipeline ifc2xgf` selects the IFC-to-XGF conversion pipeline.
- `--ifc` points to the source IFC file.
- `--xgf` writes the converted XGF geometry.
- `--datamodel` writes the converted BIM semantic graph.
- `--inspect-fix --inspect-checks all` validates and optimizes the scene model before export.
- The report flags write JSON diagnostics that are useful in CI and support workflows.

If you only want conversion without validation reports, use the shorter command:

```bash
npx xeoconvert \
  --pipeline ifc2xgf \
  --ifc ./source/model.ifc \
  --xgf ./public/models/my-building/model.xgf \
  --datamodel ./public/models/my-building/datamodel.json
```

---

## 3. Add a Viewer Page

Create a page with a canvas:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>xeokit V3 IFC to XGF Viewer</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      #myCanvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="myCanvas"></canvas>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
```

Then create `viewer.js`:

```js
import {Scene} from "@xeokit/sdk/model/scene";
import {Data} from "@xeokit/sdk/model/data";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";

const scene = new Scene();
const data = new Data();
const viewer = new Viewer({scene});
const renderer = new WebGLRenderer({viewer});

renderer.events.onError.subscribe((_renderer, error) => {
  console.error(error.error);
});

const viewResult = viewer.createView({
  id: "main",
  elementId: "myCanvas"
});

if (!viewResult.ok) {
  throw new Error(viewResult.error);
}

const view = viewResult.value;

view.camera.eye = [20, 20, 20];
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];
view.effects.edges.enabled = true;

new ModelNavigationController(view);

const sceneModelResult = scene.createModel({
  id: "my-building",
  coordinateSystem: {
    basis: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ],
    origin: [0, 0, 0],
    units: "meters",
    scaleToMeters: 1
  }
});

if (!sceneModelResult.ok) {
  throw new Error(sceneModelResult.error);
}

const dataModelResult = data.createModel({
  id: "my-building"
});

if (!dataModelResult.ok) {
  throw new Error(dataModelResult.error);
}

const sceneModel = sceneModelResult.value;
const dataModel = dataModelResult.value;

const [xgfBuffer, dataModelParams] = await Promise.all([
  fetch("./models/my-building/model.xgf").then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch model.xgf: ${response.status}`);
    }
    return response.arrayBuffer();
  }),
  fetch("./models/my-building/datamodel.json").then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch datamodel.json: ${response.status}`);
    }
    return response.json();
  })
]);

await new XGFLoader().load({
  fileData: xgfBuffer,
  sceneModel
});

await new DataModelImporter().load({
  fileData: dataModelParams,
  dataModel
});

console.log("Loaded SceneModel objects:", Object.keys(scene.objects).length);
console.log("Loaded DataModel objects:", Object.keys(data.objects).length);
```

Run the app with your normal dev server. For example, with Vite:

```bash
npm create vite@latest ifc-xgf-viewer -- --template vanilla
cd ifc-xgf-viewer
npm install
npm install @xeokit/sdk
```

Put the converted files under:

```text
public/models/my-building/model.xgf
public/models/my-building/datamodel.json
```

Then run:

```bash
npm run dev
```

---

## 4. Use WebGPU Instead of WebGL

To use WebGPU, swap the renderer import and creation code:

```js
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";

const rendererResult = await WebGPURenderer.create({viewer});

if (!rendererResult.ok) {
  throw new Error(rendererResult.error);
}

const renderer = rendererResult.value;
```

WebGPU device creation is asynchronous and depends on browser/adapter support. Check
support before making WebGPU mandatory in your application:

```js
if (!WebGPURenderer.isSupported()) {
  console.warn("WebGPU is not available in this runtime.");
}
```

---

## 5. Use the Semantic Data

The XGF file gives the viewer renderable model content. The `datamodel.json` file gives
the application BIM semantics. After loading both, IDs connect visual objects in
`scene.objects` with semantic objects in `data.objects`.

For example, list the IFC object type counts:

```js
console.table(data.typeCounts);
```

Select all objects of a known IFC type:

```js
const wallIds = Object.keys(data.objectsByType.IfcWall ?? {});
view.setObjectsSelected(wallIds, true);
```

---

## Troubleshooting

- **The CLI command is not found**: run it through `npx xeoconvert`, or build the local
  checkout with `pnpm --filter @xeokit/sdk sdk-dist` and run
  `node packages/sdk/dist/xeoconvert/xeoconvert.js`.
- **The browser fetch fails**: serve the page through a dev server. Do not open the HTML
  file directly from disk.
- **The model loads but looks empty**: adjust the camera to frame the model, enable edges,
  and check the browser console for loader or renderer errors.
- **BIM data is missing**: make sure the `--datamodel` output was written and loaded with
  `DataModelImporter`.
- **WebGPU creation fails**: use `WebGPURenderer.isSupported()` and keep a WebGL fallback
  for browsers or machines without WebGPU support.
