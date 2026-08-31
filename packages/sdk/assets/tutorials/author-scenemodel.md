---
title: Programmatically Author and View a SceneModel
---

# Programmatically Author and View a SceneModel

This tutorial shows how to create a small xeokit model directly in JavaScript and
view it immediately. Use this pattern when your application generates geometry at
runtime, builds temporary analysis overlays, imports from a custom in-memory
format, or creates test fixtures without first writing XGF, glTF or another file
format.

The central concept is that a `SceneModel` is an authored renderable model inside
a `Scene`. It is not a renderer and it is not a DOM widget. It contains the
components that describe model content:

- `SceneGeometry` stores reusable vertex data, such as positions and indices.
- `SceneMaterial` stores reusable material state, such as color, opacity and PBR
  factors.
- `SceneMesh` instantiates one geometry with a transform and optional material.
  Multiple meshes can reuse the same geometry.
- `SceneObject` is the semantic object users pick, select, hide, color or query.
  An object groups one or more meshes.
- `Viewer`, `View` and `Renderer` present the scene in the browser.

There is no separate `build()` or `finalize()` call for normal SceneModel
authoring. Each successful `create*` call registers the component and emits the
scene event that viewers and renderers use to update their internal state.

[![Authored table-shaped SceneModel](https://xeokit.github.io/sdk/examples/create/scene/from-params-table/index.png)](https://xeokit.github.io/sdk/examples/index.html#create/scene/from-params-table)

The live
[Creating a Model from JSON](https://xeokit.github.io/sdk/examples/index.html#create/scene/from-params-table)
example shows a small authored `SceneModel` loaded from SDK params and rendered
directly in the viewer.

---

## 1. Add a Canvas

Create a page with one canvas and load your JavaScript module:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>xeokit SceneModel Authoring</title>
    <style>
      html,
      body,
      canvas {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      canvas {
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="viewerCanvas"></canvas>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
```

The canvas becomes the `htmlElement` for the xeokit `View`.

---

## 2. Create the Viewer

Create `viewer.js`, then initialize the shared scene, viewer, view and renderer:

```javascript
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Scene} from "@xeokit/sdk/model/scene";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";

const scene = new Scene();
const viewer = new Viewer({scene});

const view = must(viewer.createView({
  id: "main",
  htmlElement: document.getElementById("viewerCanvas"),
  backgroundColor: [0.94, 0.96, 0.98],
  camera: {
    eye: [8, -10, 7],
    look: [0, 0, 1],
    up: [0, 0, 1]
  }
}));

const renderer = new WebGLRenderer({viewer});
new ModelNavigationController(view);

const model = createSampleModel(scene);

window.demo = {
  scene,
  viewer,
  view,
  renderer,
  model
};

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
```

The `Scene` owns the model data. The `Viewer` observes the scene and creates
view-specific presentation wrappers as objects appear.

---

## 3. Author Geometry, Materials, Meshes and Objects

Add `createSampleModel()` to the same file:

```javascript
function createSampleModel(scene) {
  const model = must(scene.createModel({
    id: "authored-building",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  }));

  must(model.createGeometry({
    id: "boxGeometry",
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
  }));

  must(model.createMaterial({
    id: "wallMaterial",
    color: [0.78, 0.82, 0.86],
    roughness: 0.75
  }));

  must(model.createMaterial({
    id: "roofMaterial",
    color: [0.46, 0.1, 0.08],
    roughness: 0.65
  }));

  must(model.createMesh({
    id: "wallMesh",
    geometryId: "boxGeometry",
    materialId: "wallMaterial",
    position: [0, 0, 1.25],
    scale: [4, 3, 2.5]
  }));

  must(model.createMesh({
    id: "roofMesh",
    geometryId: "boxGeometry",
    materialId: "roofMaterial",
    position: [0, 0, 2.8],
    scale: [4.4, 3.4, 0.35]
  }));

  must(model.createObject({
    id: "building-walls",
    meshIds: ["wallMesh"]
  }));

  must(model.createObject({
    id: "building-roof",
    meshIds: ["roofMesh"]
  }));

  return model;
}
```

This creates one reusable box geometry, two materials, two transformed mesh
instances and two semantic objects. The object IDs are the stable handles your
application uses later for picking, selection, visibility and metadata.

---

## 4. Reuse Geometry for More Objects

Geometry is deliberately separate from mesh instances. To add windows, reuse the
same `boxGeometry` with different transforms and colors:

```javascript
function addWindow(model, id, position) {
  const meshId = `${id}-mesh`;

  must(model.createMesh({
    id: meshId,
    geometryId: "boxGeometry",
    color: [0.1, 0.32, 0.55],
    opacity: 0.65,
    position,
    scale: [0.55, 0.08, 0.45]
  }));

  must(model.createObject({
    id,
    meshIds: [meshId]
  }));
}

addWindow(model, "window-1", [-1.1, -1.54, 1.45]);
addWindow(model, "window-2", [ 1.1, -1.54, 1.45]);
addWindow(model, "window-3", [-1.1, -1.54, 2.15]);
addWindow(model, "window-4", [ 1.1, -1.54, 2.15]);
```

Use a `SceneMaterial` when many meshes share the same material definition. Use a
mesh `color` when the color is specific to that mesh instance.

---

## 5. Style Authored Objects in the View

After an object is created in the model, each view receives a corresponding
`ViewObject`. The `SceneObject` is shared model data; the `ViewObject` is
per-view presentation state.

```javascript
const roofViewObject = view.objects["building-roof"];

if (roofViewObject) {
  roofViewObject.setStyleBin("highlighted", true);
}
```

This distinction matters when an application has more than one view. The same
authored object can be highlighted in one view and left unchanged in another.

---

## 6. Add Authoring Helpers

For larger generated models, wrap result handling and ID generation so failures
stop close to the mistake that caused them:

```javascript
function addBoxObject(model, params) {
  const {
    id,
    position,
    scale,
    color
  } = params;

  const meshId = `${id}-mesh`;

  must(model.createMesh({
    id: meshId,
    geometryId: "boxGeometry",
    color,
    position,
    scale
  }));

  return must(model.createObject({
    id,
    meshIds: [meshId]
  }));
}

addBoxObject(model, {
  id: "door",
  position: [0, -1.56, 0.65],
  scale: [0.8, 0.08, 1.3],
  color: [0.18, 0.12, 0.08]
});
```

`createGeometry`, `createMaterial`, `createMesh` and `createObject` return
`SDKResult` values instead of throwing for ordinary validation errors. Always
check the result when authoring programmatically, especially when IDs or mesh
references are generated.

---

## 7. Authoring Guidelines

Keep geometry reusable. Create one geometry for repeated shapes and instantiate it
with many meshes. This is the same geometry-to-instance split used by file
loaders.

Create objects at the granularity users will interact with. A wall, slab, pipe,
space, annotation or analysis marker should be a separate `SceneObject` when it
needs its own selection, visibility, color or metadata.

Use transforms on meshes for placement. Keep positions in model coordinates and
set the model's `coordinateSystem` when your source data uses a known basis,
origin or unit.

Use XGF when the authored model should be saved and reloaded later. Direct
SceneModel authoring is ideal for generated runtime content; XGF is the compact
transport format for persisted model data.
