---
title: Author SceneModel Lines, Points and Overlays
---

# Author SceneModel Lines, Points and Overlays

This tutorial shows how to author non-surface geometry with `SceneModel`.
Triangle meshes are the usual choice for model surfaces, but many applications
also need lines, points and lightweight overlays: measurement leaders, grids,
axes, route traces, markers, survey points, analysis hints and temporary tool
graphics.

The core concepts are:

- `TrianglesPrimitive` draws indexed triangle surfaces.
- `LinesPrimitive` draws indexed line segments. Each pair of indices defines one
  segment.
- `PointsPrimitive` draws one point per position. Point geometry does not need
  indices.
- `SceneObject` is still the interaction boundary. Lines and points can be
  pickable, visible, placed in style bins, colorized and grouped into layers.
- `SceneObject.clippable: false` is useful for annotations and tool overlays
  that should remain visible when section planes cut the model.

Use overlays as normal `SceneObject`s when they need picking, visibility,
semantic lookup or view state. Use a separate generated `SceneModel` for tool
graphics and analysis output when you do not want to mutate an imported model.

[![Authored 3D point model](https://xeokit.github.io/sdk/examples/create/scene/points/index.png)](https://xeokit.github.io/sdk/examples/index.html#create/scene/points)

The live
[Creating 3D Points](https://xeokit.github.io/sdk/examples/index.html#create/scene/points)
example shows non-surface authored point geometry in the viewer.

---

## 1. Create the Viewer and Model

Start with a `View` configured for readable points, then set the default line
appearance:

```javascript
import {
  LinesPrimitive,
  PointsPrimitive,
  TrianglesPrimitive
} from "@xeokit/sdk/base/constants";
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
  pointsMaterial: {
    pointSize: 6,
    roundPoints: true,
    perspectivePoints: true,
    minPerspectivePointSize: 3,
    maxPerspectivePointSize: 10
  },
  camera: {
    eye: [8, -10, 6],
    look: [0, 0, 1],
    up: [0, 0, 1]
  }
});

if (!viewResult.ok) {
  throw new Error(viewResult.error);
}

const view = viewResult.value;
view.linesMaterial.lineWidth = 2;
view.linesMaterial.linePattern = "solid";

const renderer = new WebGLRenderer({viewer});
new ModelNavigationController(view);

const modelResult = scene.createModel({
  id: "overlay-demo",
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
```

`pointsMaterial` is view state because point size is a presentation choice.
Line width also has a view default, while individual line materials can override
that default.

---

## 2. Add a Small Triangle Reference Model

Add one simple surface object so the overlays have something to annotate:

```javascript
const slabGeometryResult = model.createGeometry({
  id: "slabGeometry",
  primitive: TrianglesPrimitive,
  positions: [
    -2.5, -1.5, 0,
     2.5, -1.5, 0,
     2.5,  1.5, 0,
    -2.5,  1.5, 0,
    -2.5, -1.5, 0.25,
     2.5, -1.5, 0.25,
     2.5,  1.5, 0.25,
    -2.5,  1.5, 0.25
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

if (!slabGeometryResult.ok) {
  throw new Error(slabGeometryResult.error);
}

const slabMeshResult = model.createMesh({
  id: "slabMesh",
  geometryId: "slabGeometry",
  color: [0.72, 0.74, 0.72]
});

if (!slabMeshResult.ok) {
  throw new Error(slabMeshResult.error);
}

const slabObjectResult = model.createObject({
  id: "slab",
  meshIds: ["slabMesh"],
  layerId: "model"
});

if (!slabObjectResult.ok) {
  throw new Error(slabObjectResult.error);
}
```

This is ordinary triangle content. The line and point overlays below use the
same `createGeometry()`, `createMesh()` and `createObject()` flow.

---

## 3. Author Line Geometry

A `LinesPrimitive` geometry stores vertex positions plus line connectivity.
Every pair of indices is one segment.

```javascript
const axesGeometryResult = model.createGeometry({
  id: "axesGeometry",
  primitive: LinesPrimitive,
  positions: [
    0, 0, 0.3,
    1.5, 0, 0.3,
    0, 0, 0.3,
    0, 1.5, 0.3,
    0, 0, 0.3,
    0, 0, 1.8
  ],
  indices: [
    0, 1,
    2, 3,
    4, 5
  ],
  colors: [
    1, 0.1, 0.1, 1,
    1, 0.1, 0.1, 1,
    0.1, 0.7, 0.1, 1,
    0.1, 0.7, 0.1, 1,
    0.1, 0.25, 1, 1,
    0.1, 0.25, 1, 1
  ]
});

if (!axesGeometryResult.ok) {
  throw new Error(axesGeometryResult.error);
}

const axesMeshResult = model.createMesh({
  id: "axesMesh",
  geometryId: "axesGeometry"
});

if (!axesMeshResult.ok) {
  throw new Error(axesMeshResult.error);
}

const axesObjectResult = model.createObject({
  id: "local-axes",
  meshIds: ["axesMesh"],
  layerId: "overlays",
  clippable: false
});

if (!axesObjectResult.ok) {
  throw new Error(axesObjectResult.error);
}
```

Vertex colors are useful for compact overlay geometry because one line geometry
can carry several colors without creating several materials.

---

## 4. Use Line Materials for Drawing Conventions

Create line materials when you want named line styles or per-material line
widths. `lineWidth` is in pixels. `linePattern` can be a named style or a custom
dash/gap array measured in line-width units.

```javascript
const dashedMaterialResult = model.createMaterial({
  id: "measurement-line",
  color: [0.05, 0.1, 0.12],
  lineWidth: 3,
  linePattern: "dashed"
});

if (!dashedMaterialResult.ok) {
  throw new Error(dashedMaterialResult.error);
}

const measurementGeometryResult = model.createGeometry({
  id: "measurementGeometry",
  primitive: LinesPrimitive,
  positions: [
    -2.5, -1.7, 0.35,
     2.5, -1.7, 0.35,
    -2.5, -1.55, 0.35,
    -2.5, -1.85, 0.35,
     2.5, -1.55, 0.35,
     2.5, -1.85, 0.35
  ],
  indices: [
    0, 1,
    2, 3,
    4, 5
  ]
});

if (!measurementGeometryResult.ok) {
  throw new Error(measurementGeometryResult.error);
}

const measurementMeshResult = model.createMesh({
  id: "measurementMesh",
  geometryId: "measurementGeometry",
  materialId: "measurement-line"
});

if (!measurementMeshResult.ok) {
  throw new Error(measurementMeshResult.error);
}

const measurementObjectResult = model.createObject({
  id: "slab-width-measurement",
  meshIds: ["measurementMesh"],
  layerId: "measurements",
  clippable: false
});

if (!measurementObjectResult.ok) {
  throw new Error(measurementObjectResult.error);
}
```

Use the view-level `view.linesMaterial` for broad defaults. Use
`SceneMaterial.lineWidth` and `SceneMaterial.linePattern` when a specific line
mesh needs to override those defaults.

---

## 5. Author Point Geometry

A `PointsPrimitive` geometry needs positions only. Each position is drawn as one
point.

```javascript
const controlPointsGeometryResult = model.createGeometry({
  id: "controlPointsGeometry",
  primitive: PointsPrimitive,
  positions: [
    -2.5, -1.5, 0.35,
     2.5, -1.5, 0.35,
     2.5,  1.5, 0.35,
    -2.5,  1.5, 0.35,
     0.0,  0.0, 0.55
  ],
  colors: [
    1.0, 0.25, 0.1, 1,
    1.0, 0.25, 0.1, 1,
    1.0, 0.25, 0.1, 1,
    1.0, 0.25, 0.1, 1,
    0.1, 0.35, 1.0, 1
  ]
});

if (!controlPointsGeometryResult.ok) {
  throw new Error(controlPointsGeometryResult.error);
}

const controlPointsMeshResult = model.createMesh({
  id: "controlPointsMesh",
  geometryId: "controlPointsGeometry"
});

if (!controlPointsMeshResult.ok) {
  throw new Error(controlPointsMeshResult.error);
}

const controlPointsObjectResult = model.createObject({
  id: "control-points",
  meshIds: ["controlPointsMesh"],
  layerId: "overlays",
  clippable: false
});

if (!controlPointsObjectResult.ok) {
  throw new Error(controlPointsObjectResult.error);
}
```

Point size is controlled by `view.pointsMaterial`, not by the geometry. That
keeps the same point model usable in multiple views with different point-size
policies.

---

## 6. Keep Tool Overlays Separate

For temporary tool graphics, create a separate `SceneModel`. This keeps imported
or converted model data unchanged while still using the same viewer, renderer
and object-state APIs.

```javascript
const toolModelResult = scene.createModel({
  id: "measurement-tool-overlays"
});

if (!toolModelResult.ok) {
  throw new Error(toolModelResult.error);
}

const toolModel = toolModelResult.value;
```

You can create line and point geometry in `toolModel` exactly as shown above.
Use stable object IDs when the overlay should be selectable or editable, and
destroy the overlay model when the tool session ends.

```javascript
view.setObjectsInStyleBin("highlighted", ["slab-width-measurement"], true);
view.setObjectsPickable(["local-axes"], false);
view.setObjectsCollidable(["local-axes", "control-points"], false);
```

These are normal `ViewObject` state updates. They do not mutate the geometry or
the source model.

---

## 7. Use Layers for Overlay Control

Put helper objects into explicit layers so applications can show, hide and
configure them separately from model geometry.

```javascript
const overlayLayer = view.layers.overlays;
const measurementLayer = view.layers.measurements;

overlayLayer.setObjectsVisible(overlayLayer.objectIds, true);
measurementLayer.setObjectsInStyleBin("xrayed", measurementLayer.objectIds, false);
measurementLayer.setObjectsPickable(measurementLayer.objectIds, true);
```

Common layer names include `overlays`, `measurements`, `annotations`, `analysis`,
`grids`, `axes` and `survey`. Layers are view organization. Use a `DataModel`
when overlays also need persistent semantic data or relationships.

---

## 8. Rules of Thumb

Use `TrianglesPrimitive` for surfaces, `LinesPrimitive` for connected segments
and `PointsPrimitive` for unconnected markers or point samples.

For `LinesPrimitive`, provide indices in pairs. For `PointsPrimitive`, omit
indices.

Use vertex colors for compact overlays with several colors in one geometry. Use
`SceneMaterial` when you need a reusable line style, line width, line pattern or
named appearance.

Use `clippable: false` for annotations, measurements and tool overlays that
should stay visible while section planes cut the model.

Turn off `pickable` for helper geometry that should not block picking real model
objects. Turn off `collidable` for overlays that should not affect boundary or
navigation calculations.

Prefer a separate generated `SceneModel` for temporary overlays instead of
adding tool geometry into an imported model.

Keep overlay objects as real `SceneObject`s when users need to select, hide,
highlight, pick or query them.
