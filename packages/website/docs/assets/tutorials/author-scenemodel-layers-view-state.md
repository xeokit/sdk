---
title: Author SceneModel Layers and View State
---

# Author SceneModel Layers and View State

This tutorial shows how to organize authored `SceneObject`s into `ViewLayer`s
and control their per-view presentation. This is the layer and view-state side
of SceneModel authoring: the model supplies stable objects, while each `View`
decides how those objects are shown.

The important concepts are:

- `SceneObject` is model data. It owns one or more meshes and carries the stable
  object ID used by picking, semantic lookup and view state.
- `layerId` is authored on a `SceneObject`. It tells each `View` which
  `ViewLayer` should contain that object's `ViewObject`.
- `ViewObject` is the per-view presentation wrapper for one `SceneObject`.
  Visibility, x-ray, selection, highlighting, colorization, opacity,
  pickability, clippability and collidability live here.
- `ViewLayer` groups `ViewObject`s inside one `View`. Layers are useful for
  controlling broad categories such as structure, facade, services,
  annotations, terrain or analysis results.

This split matters when the same model is shown in multiple views. The
`SceneObject` is shared model content, but each `View` has its own `ViewObject`
state. One view can show services as x-rayed while another hides them. One view
can show annotations while another ignores annotation layers completely.

---

## 1. Create a View

Create the scene, viewer, view and renderer as usual:

```javascript
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Scene} from "@xeokit/sdk/model/scene";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";

const scene = new Scene();
const viewer = new Viewer({scene});

const viewResult = viewer.createView({
  id: "main",
  htmlElement: document.getElementById("viewerCanvas"),
  backgroundColor: [0.94, 0.96, 0.98],
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
const renderer = new WebGLRenderer({viewer});
new ModelNavigationController(view);
```

By default, a `View` uses `autoLayers: true`. When a `SceneObject` appears, the
view creates a matching `ViewObject`. If the `SceneObject` has a `layerId`, the
`ViewObject` goes into that layer. If it has no `layerId`, it goes into the
default layer.

---

## 2. Author Objects with Layer IDs

Create a simple model and one reusable box geometry:

```javascript
const modelResult = scene.createModel({
  id: "layered-building",
  coordinateSystem: {
    basis: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ],
    origin: [0, 0, 0],
    units: "meters"
  }
});

if (!modelResult.ok) {
  throw new Error(modelResult.error);
}

const model = modelResult.value;

const geometryResult = model.createGeometry({
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
```

Use a helper that creates one mesh and one object. The `layerId` is authored on
the `SceneObject`, not on the mesh, because layers group user-facing objects.

```javascript
function createBoxObject(params) {
  const meshId = `${params.id}-mesh`;

  const meshResult = model.createMesh({
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

  const objectResult = model.createObject({
    id: params.id,
    meshIds: [meshId],
    layerId: params.layerId,
    clippable: params.clippable
  });

  if (!objectResult.ok) {
    throw new Error(objectResult.error);
  }
}
```

Now create objects in a few layers:

```javascript
createBoxObject({
  id: "core",
  layerId: "structure",
  color: [0.72, 0.74, 0.7],
  position: [0, 0, 1.3],
  scale: [4.6, 3.0, 2.6]
});

createBoxObject({
  id: "roof",
  layerId: "structure",
  color: [0.42, 0.43, 0.45],
  position: [0, 0, 2.75],
  scale: [4.9, 3.3, 0.25]
});

for (let floor = 0; floor < 3; floor++) {
  for (let bay = 0; bay < 4; bay++) {
    createBoxObject({
      id: `window-${floor}-${bay}`,
      layerId: "facade",
      color: [0.16, 0.38, 0.62],
      opacity: 0.62,
      position: [-1.8 + bay * 1.2, -1.54, 0.75 + floor * 0.72],
      scale: [0.58, 0.08, 0.34]
    });
  }
}

createBoxObject({
  id: "service-riser",
  layerId: "services",
  color: [0.86, 0.38, 0.12],
  position: [1.8, 1.1, 1.35],
  scale: [0.35, 0.35, 2.4]
});

createBoxObject({
  id: "level-marker",
  layerId: "annotations",
  color: [0.1, 0.1, 0.1],
  position: [-2.8, -1.75, 1.5],
  scale: [0.12, 0.12, 2.6],
  clippable: false
});
```

The view now has `ViewLayer`s named `structure`, `facade`, `services` and
`annotations`, each containing `ViewObject`s for matching `SceneObject`s.

---

## 3. Use Layers for Coarse Controls

Each layer exposes its object IDs. Use those IDs with layer or view batch
methods to update many objects at once.

```javascript
const structureLayer = view.layers.structure;
const facadeLayer = view.layers.facade;
const servicesLayer = view.layers.services;
const annotationsLayer = view.layers.annotations;

structureLayer.setObjectsSelected(structureLayer.objectIds, true);
facadeLayer.setObjectsXRayed(facadeLayer.objectIds, true);
servicesLayer.setObjectsVisible(servicesLayer.objectIds, false);
annotationsLayer.setObjectsPickable(annotationsLayer.objectIds, false);
```

These calls update only this `View`. The underlying `SceneObject`s and
`SceneMesh`es are unchanged, so another view can use different layer state for
the same scene.

Layer methods are convenient when the operation maps exactly to one layer. Use
`View` methods when you are applying state to object IDs gathered from several
layers, semantic search, picking, a selection set or application logic.

---

## 4. Use View State for Object-Level Interaction

You can update individual objects through `view.objects`, or update many objects
with `View` batch methods.

```javascript
view.objects["service-riser"].highlighted = true;

view.setObjectsColorized(
  ["window-0-0", "window-0-1", "window-0-2", "window-0-3"],
  [0.15, 0.55, 1.0]
);

view.setObjectsOpacity(["core"], 0.35);
view.setObjectsXRayed(["core"], true);
```

This state belongs to the `ViewObject`. It is presentation state, not source
model data. Use it for selection, isolation, hover feedback, analysis results
and temporary workflows. Keep persistent object facts in a `DataModel`.

To clear colorization or opacity overrides on a `View`, pass `null`:

```javascript
view.setObjectsColorized(["window-0-0", "window-0-1"], null);
view.setObjectsOpacity(["core"], null);
```

Clearing the override returns those objects to their authored material or mesh
appearance.

---

## 5. Control Pickability, Clippability and Collidability

View state also controls how objects participate in interaction and tools:

```javascript
view.setObjectsPickable(annotationsLayer.objectIds, false);
view.setObjectsClippable(annotationsLayer.objectIds, false);
view.setObjectsCollidable(annotationsLayer.objectIds, false);
```

`pickable` controls whether picking can hit the objects. Turn it off for helper
geometry that should not block picking of real model elements.

`clippable` controls whether section planes clip the objects. It defaults to
`true`, but can be initialized with `clippable: false` on `SceneObjectParams`.
That is useful for annotation, drawing and tool overlay objects that should
remain visible while the model is sectioned.

`collidable` controls whether objects participate in boundary and collision
style calculations. Turn it off for labels, markers and other out-of-band
objects.

---

## 6. Create Views with Explicit Layers

The default `autoLayers: true` is usually right for a normal viewer because it
creates `ViewObject`s for every `SceneObject`. For specialized views, use
`autoLayers: false` and create only the layers that view should contain.

```javascript
const structureOnlyResult = viewer.createView({
  id: "structureOnly",
  htmlElement: document.getElementById("structureCanvas"),
  autoLayers: false,
  camera: {
    eye: [8, -10, 6],
    look: [0, 0, 1.2],
    up: [0, 0, 1]
  }
});

if (!structureOnlyResult.ok) {
  throw new Error(structureOnlyResult.error);
}

const structureOnlyView = structureOnlyResult.value;

const structureLayerResult = structureOnlyView.createLayer({
  id: "structure"
});

if (!structureLayerResult.ok) {
  throw new Error(structureLayerResult.error);
}
```

This second view contains `ViewObject`s for `SceneObject`s whose `layerId` is
`"structure"`. It does not create view objects for facade, services or
annotation objects, which keeps the view focused and avoids maintaining
presentation state it will never use.

---

## 7. Rules of Thumb

Use `layerId` for stable authored categories: structure, facade, services,
terrain, annotations, analysis, spaces or systems. Do not use layers as a
replacement for semantic relationships; use a `DataModel` for object trees,
property sets and domain relationships.

Use `SceneObject` boundaries for the things users need to pick, isolate, hide,
select or query. A layer can contain many objects, and one object can contain
many meshes, but a `ViewObject` is created for each `SceneObject`.

Use `ViewLayer` methods for broad layer operations and `View` methods for mixed
object sets. Semantic search, selection tools and picking often produce object
IDs that span several layers.

Keep presentation state on the `ViewObject`. Do not rewrite geometry or
materials just to show hover, selection, x-ray, visibility, colorization or
opacity changes.

Use `autoLayers: false` only for specialized views that intentionally show a
subset of the scene. For general viewers, the default `autoLayers: true` is the
simplest and least surprising behavior.
