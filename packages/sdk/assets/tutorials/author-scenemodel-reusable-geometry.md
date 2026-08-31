---
title: Author Reusable Geometry and Mesh Instances
---

# Author Reusable Geometry and Mesh Instances

This tutorial shows how to build a `SceneModel` from a small set of reusable
geometries and many mesh instances. This is the normal pattern for repeated
building parts: windows, facade panels, columns, chairs, fasteners, tiles, duct
segments, fittings, and other objects that share the same shape but appear many
times with different transforms, colors, opacity, or metadata.

The important distinction is between shape, placement, and semantics:

- `SceneGeometry` stores vertex data once. It describes a reusable shape.
- `SceneMesh` places one geometry in the model. It applies transform and
  appearance for one rendered instance.
- `SceneObject` is the user-facing object. It is what applications pick,
  select, hide, x-ray, colorize, and connect to metadata.

Keeping these concepts separate avoids duplicating vertex arrays for repeated
parts. It also gives renderers a better chance to pack compatible meshes into
large GPU batches while preserving object-level interaction.

[![Table model built from reusable scene parameters](https://xeokit.github.io/sdk/examples/create/scene/from-params-table/index.png)](https://xeokit.github.io/sdk/examples/index.html#create/scene/from-params-table)

The live
[Creating a Model from JSON](https://xeokit.github.io/sdk/examples/index.html#create/scene/from-params-table)
example shows the same reusable geometry and mesh-instance structure in a small
authored model.

---

## 1. Create the Model

Start with a `Scene`, `Viewer`, `View`, renderer, and navigation controller.
This tutorial uses `WebGLRenderer` because it is synchronous to construct; the
same `SceneModel` can also be viewed with `WebGPURenderer`.

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
    eye: [9, -10, 7],
    look: [0, 0, 1.5],
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

Now create a model. The default lifecycle is open, which is appropriate for
small programmatic models and generated examples.

```javascript
const modelResult = scene.createModel({
  id: "reusable-parts-demo",
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

---

## 2. Create One Reusable Box Geometry

The geometry below is a unit cube centered at the origin. It is intentionally
small and generic because each mesh instance will scale and position it.

```javascript
const boxGeometryResult = model.createGeometry({
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

if (!boxGeometryResult.ok) {
  throw new Error(boxGeometryResult.error);
}
```

Every mesh in the rest of this tutorial references `unitBox`. The model stores
the positions and indices once.

---

## 3. Create Shared Materials

Materials are reusable too. Use them when many meshes share the same appearance.

```javascript
const materialParams = [
  {
    id: "concrete",
    color: [0.74, 0.76, 0.72],
    roughness: 0.85
  },
  {
    id: "glass",
    color: [0.16, 0.38, 0.62],
    opacity: 0.58,
    roughness: 0.18,
    metallic: 0
  },
  {
    id: "steel",
    color: [0.48, 0.5, 0.52],
    roughness: 0.42,
    metallic: 0.55
  }
];

for (const params of materialParams) {
  const result = model.createMaterial(params);
  if (!result.ok) {
    throw new Error(result.error);
  }
}
```

A mesh can either reference a material with `materialId`, or use per-instance
appearance fields such as `color` and `opacity`. Prefer `materialId` when the
same appearance is reused many times.

---

## 4. Add Mesh Instances

A mesh instance combines a reusable geometry with placement and appearance.
This helper creates one mesh and one object together.

```javascript
function createBoxObject(params) {
  const meshId = `${params.id}-mesh`;

  const meshResult = model.createMesh({
    id: meshId,
    geometryId: "unitBox",
    materialId: params.materialId,
    position: params.position,
    rotation: params.rotation,
    scale: params.scale
  });

  if (!meshResult.ok) {
    throw new Error(meshResult.error);
  }

  const objectResult = model.createObject({
    id: params.id,
    meshIds: [meshId]
  });

  if (!objectResult.ok) {
    throw new Error(objectResult.error);
  }

  return objectResult.value;
}
```

Create the main structural parts:

```javascript
createBoxObject({
  id: "core",
  materialId: "concrete",
  position: [0, 0, 1.5],
  scale: [4.8, 3.2, 3.0]
});

createBoxObject({
  id: "roof-slab",
  materialId: "steel",
  position: [0, 0, 3.15],
  scale: [5.2, 3.6, 0.22]
});

createBoxObject({
  id: "ground-slab",
  materialId: "steel",
  position: [0, 0, -0.12],
  scale: [5.4, 3.8, 0.24]
});
```

Each object above draws the same geometry with a different transform and
material. The object IDs remain independent for picking and view state.

---

## 5. Generate Repeated Parts

Repeated parts are where reusable geometry pays off. The loop below creates
twelve windows from the same `unitBox` geometry and `glass` material.

```javascript
for (let floor = 0; floor < 3; floor++) {
  const z = 0.85 + floor * 0.85;

  for (let bay = 0; bay < 4; bay++) {
    const x = -1.8 + bay * 1.2;

    createBoxObject({
      id: `south-window-${floor}-${bay}`,
      materialId: "glass",
      position: [x, -1.63, z],
      scale: [0.62, 0.08, 0.38]
    });
  }
}
```

Add columns using the same geometry again:

```javascript
for (let i = 0; i < 4; i++) {
  const x = i < 2 ? -2.15 : 2.15;
  const y = i % 2 === 0 ? -1.45 : 1.45;

  createBoxObject({
    id: `column-${i}`,
    materialId: "concrete",
    position: [x, y, 1.35],
    scale: [0.28, 0.28, 2.7]
  });
}
```

The model now contains one geometry but many rendered mesh instances. Renderers
can still maintain per-object state because each `SceneObject` has its own ID.

---

## 6. Group Multiple Meshes Into One Object

Some semantic objects need more than one mesh. A door, for example, may combine
a panel and handle. Create each mesh separately, then attach both mesh IDs to
one object.

```javascript
const doorPanelResult = model.createMesh({
  id: "entry-door-panel-mesh",
  geometryId: "unitBox",
  materialId: "steel",
  position: [0, -1.66, 0.65],
  scale: [0.78, 0.1, 1.3]
});

if (!doorPanelResult.ok) {
  throw new Error(doorPanelResult.error);
}

const doorHandleResult = model.createMesh({
  id: "entry-door-handle-mesh",
  geometryId: "unitBox",
  materialId: "steel",
  position: [0.28, -1.74, 0.68],
  scale: [0.08, 0.08, 0.08]
});

if (!doorHandleResult.ok) {
  throw new Error(doorHandleResult.error);
}

const doorObjectResult = model.createObject({
  id: "entry-door",
  meshIds: [
    "entry-door-panel-mesh",
    "entry-door-handle-mesh"
  ]
});

if (!doorObjectResult.ok) {
  throw new Error(doorObjectResult.error);
}
```

Picking or hiding `entry-door` affects both meshes because the semantic object
owns both mesh references.

---

## 7. Use View State Per Object

Geometry reuse does not collapse interaction. Each object still has independent
view state.

```javascript
const southWindow = view.objects["south-window-1-2"];

if (southWindow) {
  southWindow.setStyleBin("highlighted", true);
}

const columns = ["column-0", "column-1", "column-2", "column-3"];

for (const objectId of columns) {
  const viewObject = view.objects[objectId];
  if (viewObject) {
    viewObject.setStyleBin("xrayed", true);
  }
}
```

This is the main reason to create many `SceneObject`s even when those objects
share a small number of geometries.

---

## 8. Reuse Geometry Deliberately

A good authoring rule is to create a new `SceneGeometry` only when the vertex
data is actually different. Use additional `SceneMesh` instances when the same
shape only needs a different transform or appearance.

Use one geometry for:

- repeated windows, panels, beams, columns, fasteners, fixtures and symbols
- library parts placed many times
- generated tiles or cells with identical topology
- simple primitive shapes that differ only by scale

Create separate geometries for:

- objects with different vertex positions or indices
- objects that need different per-vertex colors or UVs
- topology that will be edited independently
- shapes whose local origin or authoring coordinate space should differ

That separation keeps authored data compact, keeps semantic objects independent,
and gives renderers the most useful information for internal batching.
