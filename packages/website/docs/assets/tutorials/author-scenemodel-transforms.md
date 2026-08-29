---
title: Author SceneModel Transforms and Hierarchies
---

# Author SceneModel Transforms and Hierarchies

This tutorial shows how to place authored model content with mesh transforms and
`SceneTransform` hierarchies. The previous authoring tutorials create objects
directly from meshes. This one focuses on coordinate spaces: where those meshes
are placed, how repeated assemblies can move together, and when a transform node
is more useful than putting `position`, `rotation` and `scale` directly on every
mesh.

The core concepts are:

- `SceneMesh` has its own local transform. You can set `position`, `rotation`,
  `quaternion`, `scale` or `matrix` when you create it.
- `SceneTransform` is a reusable transform node inside a `SceneModel`. Meshes
  and child transforms can inherit from it.
- `parentTransformId` attaches a mesh or transform to a previously created
  `SceneTransform`.
- `matrix` overrides TRS fields when supplied. Use TRS for readable authoring
  code and matrices when importing from a source format that already supplies
  transforms that way.
- `worldMatrix` is the composed result used by the runtime. Renderers consume
  the final world transform; the public authoring model stays renderer-neutral.

Use direct mesh transforms for simple independent objects. Use
`SceneTransform`s when a set of meshes should share placement, move as a group,
represent a source hierarchy, or be reparented without rebuilding geometry.

[![Table model built with transform hierarchy](https://xeokit.github.io/sdk/examples/create/transforms/table/index.png)](https://xeokit.github.io/sdk/examples/index.html#create/transforms/table)

The live
[Creating a Model with Transforms](https://xeokit.github.io/sdk/examples/index.html#create/transforms/table)
example builds a small model with a transform hierarchy.

---

## 1. Create the Viewer and Model

Start with a normal scene, viewer, view and renderer:

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
    eye: [9, -10, 6],
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

const modelResult = scene.createModel({
  id: "transform-demo",
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

The model coordinate system is the root space for the model. A root
`SceneTransform` composes with that coordinate system. A child transform composes
with its parent.

---

## 2. Create Reusable Geometry

Create a unit box once. The rest of the tutorial places instances of this
geometry with different mesh and transform nodes.

```javascript
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

---

## 3. Use Direct Mesh Transforms

For independent objects, put the transform directly on the mesh. This is compact
and clear when there is no shared parent space.

```javascript
function createBoxObject(params) {
  const meshId = `${params.id}-mesh`;

  const meshResult = model.createMesh({
    id: meshId,
    geometryId: "unitBox",
    color: params.color,
    position: params.position,
    rotation: params.rotation,
    scale: params.scale
  });

  if (!meshResult.ok) {
    throw new Error(meshResult.error);
  }

  const objectResult = model.createObject({
    id: params.id,
    meshIds: [meshId],
    layerId: params.layerId
  });

  if (!objectResult.ok) {
    throw new Error(objectResult.error);
  }
}

createBoxObject({
  id: "ground-slab",
  layerId: "structure",
  color: [0.45, 0.47, 0.46],
  position: [0, 0, -0.08],
  scale: [6.0, 4.0, 0.16]
});

createBoxObject({
  id: "north-wall",
  layerId: "structure",
  color: [0.78, 0.78, 0.74],
  position: [0, 1.9, 1.1],
  scale: [5.8, 0.2, 2.2]
});
```

The mesh local transform is enough here because each object is placed once and
does not need to inherit a group transform.

---

## 4. Create a Transform Hierarchy

Use `SceneTransform` when an assembly has its own local coordinate space. The
example below creates one door assembly transform and two child transforms for
the leaf and handle.

```javascript
const doorRootResult = model.createTransform({
  id: "door-assembly",
  position: [0, -1.95, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1]
});

if (!doorRootResult.ok) {
  throw new Error(doorRootResult.error);
}

const doorLeafTransformResult = model.createTransform({
  id: "door-leaf-transform",
  parentTransformId: "door-assembly",
  position: [0, 0, 1.0],
  scale: [0.9, 0.12, 2.0]
});

if (!doorLeafTransformResult.ok) {
  throw new Error(doorLeafTransformResult.error);
}

const doorHandleTransformResult = model.createTransform({
  id: "door-handle-transform",
  parentTransformId: "door-assembly",
  position: [0.34, -0.1, 1.05],
  scale: [0.12, 0.12, 0.12]
});

if (!doorHandleTransformResult.ok) {
  throw new Error(doorHandleTransformResult.error);
}
```

Now attach meshes to those transforms:

```javascript
const doorLeafMeshResult = model.createMesh({
  id: "door-leaf-mesh",
  geometryId: "unitBox",
  parentTransformId: "door-leaf-transform",
  color: [0.45, 0.22, 0.1]
});

if (!doorLeafMeshResult.ok) {
  throw new Error(doorLeafMeshResult.error);
}

const doorHandleMeshResult = model.createMesh({
  id: "door-handle-mesh",
  geometryId: "unitBox",
  parentTransformId: "door-handle-transform",
  color: [0.85, 0.66, 0.28]
});

if (!doorHandleMeshResult.ok) {
  throw new Error(doorHandleMeshResult.error);
}

const doorObjectResult = model.createObject({
  id: "entry-door",
  meshIds: ["door-leaf-mesh", "door-handle-mesh"],
  layerId: "facade"
});

if (!doorObjectResult.ok) {
  throw new Error(doorObjectResult.error);
}
```

The `entry-door` object contains two meshes. Each mesh inherits from its own
child transform, and both child transforms inherit from `door-assembly`.

---

## 5. Move an Assembly by Updating One Transform

Changing the root transform moves everything below it. You do not need to change
the mesh geometry or rewrite the child mesh transforms.

```javascript
const doorAssembly = model.transforms["door-assembly"];

doorAssembly.position = [1.0, -1.95, 0];
doorAssembly.rotation = [0, 0, 12];
```

The transform marks its world matrix and descendant world matrices dirty.
Renderers observe transform matrix changes and use the updated composed world
matrices when they draw.

This is the main reason to use transform nodes for assemblies: the authored
parts keep their local offsets, while the assembly can be placed, moved or
rotated as one unit.

---

## 6. Reuse the Assembly Pattern

A transform hierarchy is also useful for repeated assemblies. The function below
creates a local root for each desk, then creates child transforms for its top and
legs.

```javascript
function createDesk(id, position, rotationZ) {
  const rootId = `${id}-root`;

  const rootResult = model.createTransform({
    id: rootId,
    position,
    rotation: [0, 0, rotationZ]
  });

  if (!rootResult.ok) {
    throw new Error(rootResult.error);
  }

  const parts = [
    {
      name: "top",
      position: [0, 0, 0.75],
      scale: [1.4, 0.7, 0.08],
      color: [0.58, 0.36, 0.2]
    },
    {
      name: "leg-a",
      position: [-0.55, -0.25, 0.36],
      scale: [0.08, 0.08, 0.72],
      color: [0.2, 0.2, 0.2]
    },
    {
      name: "leg-b",
      position: [0.55, -0.25, 0.36],
      scale: [0.08, 0.08, 0.72],
      color: [0.2, 0.2, 0.2]
    },
    {
      name: "leg-c",
      position: [-0.55, 0.25, 0.36],
      scale: [0.08, 0.08, 0.72],
      color: [0.2, 0.2, 0.2]
    },
    {
      name: "leg-d",
      position: [0.55, 0.25, 0.36],
      scale: [0.08, 0.08, 0.72],
      color: [0.2, 0.2, 0.2]
    }
  ];

  const meshIds = [];

  for (const part of parts) {
    const transformId = `${id}-${part.name}-transform`;
    const meshId = `${id}-${part.name}-mesh`;

    const transformResult = model.createTransform({
      id: transformId,
      parentTransformId: rootId,
      position: part.position,
      scale: part.scale
    });

    if (!transformResult.ok) {
      throw new Error(transformResult.error);
    }

    const meshResult = model.createMesh({
      id: meshId,
      geometryId: "unitBox",
      parentTransformId: transformId,
      color: part.color
    });

    if (!meshResult.ok) {
      throw new Error(meshResult.error);
    }

    meshIds.push(meshId);
  }

  const objectResult = model.createObject({
    id,
    meshIds,
    layerId: "furniture"
  });

  if (!objectResult.ok) {
    throw new Error(objectResult.error);
  }
}

createDesk("desk-01", [-1.6, 0.3, 0], 0);
createDesk("desk-02", [1.6, 0.3, 0], 180);
```

Both desks use the same geometry. Each desk has its own transform hierarchy and
one `SceneObject` ID for picking and view state.

---

## 7. Reparent Without Moving in World Space

Meshes and transforms can be reparented after creation. Use
`preserveWorld: true` when you want the object to keep its current world-space
placement while changing its parent.

```javascript
const deskRoot = model.transforms["desk-01-root"];
const doorAssembly = model.transforms["door-assembly"];

const result = doorAssembly.setParentTransformId(deskRoot.id, {
  preserveWorld: true
});

if (!result.ok) {
  throw new Error(result.error);
}
```

This changes the door assembly's local matrix so its composed world matrix stays
the same under the new parent. Without `preserveWorld: true`, the existing local
transform would be interpreted in the new parent's coordinate space.

The same option exists when changing a mesh parent:

```javascript
const mesh = model.meshes["door-handle-mesh"];
const meshParentResult = mesh.setParentTransformId("door-assembly", {
  preserveWorld: true
});

if (!meshParentResult.ok) {
  throw new Error(meshParentResult.error);
}
```

Reparenting is useful for editing tools, temporary grouping and source-format
imports that resolve parent nodes after child content has already been created.

---

## 8. Use Matrices for Imported Transforms

When source data already provides a matrix, pass it directly:

```javascript
const matrixResult = model.createTransform({
  id: "source-node-42",
  matrix: [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    2, 3, 0, 1
  ]
});

if (!matrixResult.ok) {
  throw new Error(matrixResult.error);
}
```

When `matrix` is supplied, it defines the local transform and the transform
decomposes it into `position`, `quaternion`, `rotation` and `scale`. Prefer TRS
for hand-authored examples because it is easier to read and modify.

---

## 9. Rules of Thumb

Use direct mesh `position`, `rotation` and `scale` for simple objects that do
not need a shared parent transform.

Use `SceneTransform` for assemblies, source scene graphs, repeated local
coordinate systems, moving groups and editor-style reparenting.

Create parent transforms before children. `parentTransformId` resolves an
existing transform ID when you create a mesh or transform.

Use one `SceneObject` for the semantic/user-facing thing, even when that object
contains several meshes under several transforms. The `SceneObject` remains the
ID used for picking, selection, visibility, metadata lookup and view state.

Use `matrix` when importing exact source transforms. Use TRS for generated code,
examples and tools that are easier to maintain as position, rotation and scale.

Avoid baking repeated placement into geometry arrays. Keep geometry reusable and
move instances with mesh transforms or `SceneTransform` hierarchies.
