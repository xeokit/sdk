---
title: Build a Minimal xeokit Viewer
---

# Build a Minimal xeokit Viewer

This tutorial creates the smallest useful xeokit SDK application: one canvas,
one `Scene`, one `Viewer`, one renderer, one `View`, model navigation and one
loaded model.

Use this as the starting point for a custom product viewer, an internal model
review page, a repro case, or a tutorial project before adding object trees,
property panels, clipping tools or streaming.

The viewer runtime has four core pieces:

- `Scene` owns renderable model content.
- `Viewer` observes a scene and creates browser-facing views.
- `Renderer` draws the viewer with WebGL or WebGPU.
- `View` connects a camera, canvas and per-view presentation state.

Model files are loaded into `SceneModel`s inside the scene. A `DataModel` is
optional and stores semantic metadata such as object types, relationships and
property sets.

---

## 1. Create a Web App

For a new application project, create a Vite app and install the SDK:

```bash
npm create vite@latest xeokit-viewer -- --template vanilla
cd xeokit-viewer
npm install
npm install @xeokit/sdk
```

Put a prepared XGF file under your public directory:

```text
public/models/building/model.xgf
```

If you also have semantic model data, put it beside the XGF file:

```text
public/models/building/datamodel.json
```

The IFC conversion tutorials show how to create those files from IFC. This
tutorial assumes the runtime files already exist.

---

## 2. Add a Canvas

Replace the generated `index.html` with a page that fills the browser window:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>xeokit Viewer</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      #viewerCanvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="viewerCanvas"></canvas>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

The canvas is the DOM surface used by the xeokit `View`.

---

## 3. Create the Scene, Viewer, Renderer and View

Replace `src/main.js` with the core viewer setup:

```javascript
import {Scene} from "@xeokit/sdk/model/scene";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";

const canvas = document.getElementById("viewerCanvas");

const scene = new Scene();
const viewer = new Viewer({scene});
const renderer = new WebGLRenderer({viewer});

renderer.events.onError.subscribe((_renderer, error) => {
  console.error(error.error);
});

const view = must(viewer.createView({
  id: "main",
  htmlElement: canvas,
  backgroundColor: [0.94, 0.96, 0.98],
  camera: {
    eye: [20, -25, 18],
    look: [0, 0, 2],
    up: [0, 0, 1]
  }
}));

view.effects.edges.enabled = true;
view.effects.edges.useMeshColor = true;

const navigation = new ModelNavigationController(view);

window.viewerApp = {
  scene,
  viewer,
  renderer,
  view,
  navigation
};

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
```

Run the app:

```bash
npm run dev
```

At this point the viewer should show an empty canvas with the configured
background color. The model is added in the next step.

---

## 4. Load an XGF Model

Import `XGFLoader`:

```javascript
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
```

Then add this code after creating the navigation controller:

```javascript
const sceneModel = must(scene.createModel({
  id: "building",
  coordinateSystem: {
    basis: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ],
    origin: [0, 0, 0],
    units: "meters",
    scaleToMeters: 1
  },
  updateHint: "static",
  memoryPolicy: "compact"
}));

const xgfBuffer = await fetchArrayBuffer("/models/building/model.xgf");

await new XGFLoader().load({
  fileData: xgfBuffer,
  sceneModel
});

console.log("Loaded scene objects:", Object.keys(scene.objects).length);
```

Add the fetch helper at the bottom of the file:

```javascript
async function fetchArrayBuffer(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${src}`);
  }
  return response.arrayBuffer();
}
```

The `SceneModel` is the destination model inside the scene. The XGF loader reads
the binary runtime geometry and creates xeokit scene components inside that
model.

---

## 5. Add Semantic Data When Available

If your conversion also produced `datamodel.json`, create a `Data` container and
load a matching `DataModel`.

Add the imports:

```javascript
import {Data} from "@xeokit/sdk/model/data";
import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";
```

Create the `Data` container beside the existing `Scene`:

```javascript
const data = new Data();
```

Keep the existing renderer, `viewer.createView(...)` call and navigation setup
from section 3. The semantic `Data` container does not replace the `View`.

Then load the semantic JSON after loading XGF:

```javascript
const dataModel = must(data.createModel({
  id: "building"
}));

const dataModelParams = await fetchJSON("/models/building/datamodel.json");

await new DataModelImporter().load({
  fileData: dataModelParams,
  dataModel
});

console.log("Loaded data objects:", Object.keys(data.objects).length);
```

Add the JSON helper:

```javascript
async function fetchJSON(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${src}`);
  }
  return response.json();
}
```

Use the same IDs in visual and semantic data when you want selection, property
panels and object-tree rows to resolve to the same application object.

---

## 6. Choose WebGL or WebGPU

WebGL is the simplest default because it is synchronous and broadly available:

```javascript
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";

const renderer = new WebGLRenderer({viewer});
```

WebGPU creation is asynchronous and depends on browser and adapter support:

```javascript
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";

let renderer;

if (WebGPURenderer.isSupported()) {
  renderer = must(await WebGPURenderer.create({viewer}));
} else {
  renderer = new WebGLRenderer({viewer});
}

const view = must(viewer.createView({
  id: "main",
  htmlElement: canvas
}));
```

Use WebGL as the baseline path unless your application can require WebGPU-capable
browsers and hardware.

---

## 7. Clean Up

When the viewer belongs to a single-page application route, destroy the objects
you created when leaving that route:

```javascript
navigation.destroy();
renderer.destroy();
viewer.destroy();
scene.destroy();
```

Keep references to created controllers if the route needs to dispose them later:

```javascript
const navigation = new ModelNavigationController(view);
```

---

## Troubleshooting

- **The canvas stays blank**: confirm that the app is served through a dev server
  and that the browser console has no renderer or fetch errors.
- **The XGF fetch returns 404**: files under Vite's `public` directory are served
  from the web root, so `public/models/building/model.xgf` is fetched as
  `/models/building/model.xgf`.
- **The model loads but is off screen**: set a camera that frames your model, or
  copy a known-good camera from an existing example for that asset.
- **Navigation does nothing**: make sure `new ModelNavigationController(view)` is
  created after the `View`.
- **WebGPU creation fails**: keep the WebGL fallback path and check browser
  support before constructing a WebGPU-only viewer.
