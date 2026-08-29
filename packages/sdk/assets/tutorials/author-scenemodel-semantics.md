---
title: Author SceneModel Objects and DataModel Semantics
---

# Author SceneModel Objects and DataModel Semantics

This tutorial shows how to author the semantic side of a programmatic model.
The renderable model and the semantic model are deliberately separate in xeokit:

- `SceneModel` contains geometry, materials, meshes and `SceneObject`s. It is the
  model that renderers draw.
- `SceneObject` is the renderable object users interact with in a `View`. It has
  the stable ID used for picking, selection, visibility, highlighting and x-ray.
- `DataModel` contains `DataObject`s, property sets and relationships. It is the
  semantic graph used for object trees, property panels, search and export.
- `DataObject` is the semantic object. When a `DataObject` has the same ID as a
  `SceneObject`, application code can move directly between the visual object
  and its metadata.

Keeping rendering data and semantic data separate lets applications load or
generate only what they need. A high-performance viewer can show geometry
without a property graph, while a BIM-style application can pair the same
geometry with rich metadata, relationships and property sets.

[![Authored table with semantic data](https://xeokit.github.io/sdk/examples/create/data/table-with-semantics/index.png)](https://xeokit.github.io/sdk/examples/index.html#create/data/table-with-semantics)

The live
[Creating a Model with Semantic Data](https://xeokit.github.io/sdk/examples/index.html#create/data/table-with-semantics)
example pairs a generated `SceneModel` with a matching `DataModel`.

---

## 1. Create Scene and Data Containers

Create a `Scene` for renderable content and a `Data` for semantic content.
They are separate roots because they have different jobs and lifecycles.

```javascript
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Data, searchObjects} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";

const scene = new Scene();
const data = new Data();
const viewer = new Viewer({scene});

const viewResult = viewer.createView({
  id: "main",
  htmlElement: document.getElementById("viewerCanvas"),
  backgroundColor: [0.94, 0.96, 0.98],
  camera: {
    eye: [8, -10, 7],
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

The renderer observes the `Scene`. It does not need to know about the
`DataModel`. Application code uses the shared object IDs to connect picking and
view state to semantic data.

---

## 2. Create Matching Models

Use the same model ID for the `SceneModel` and `DataModel` when they describe
the same source asset. This keeps project structure simple when models are
loaded, unloaded, exported or inspected.

```javascript
const sceneModelResult = scene.createModel({
  id: "semantic-building",
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

if (!sceneModelResult.ok) {
  throw new Error(sceneModelResult.error);
}

const sceneModel = sceneModelResult.value;

const dataModelResult = data.createModel({
  id: "semantic-building",
  name: "Semantic Building",
  schema: "ExampleBuilding/v1",
  author: "xeokit tutorial",
  creatingApplication: "programmatic-authoring"
});

if (!dataModelResult.ok) {
  throw new Error(dataModelResult.error);
}

const dataModel = dataModelResult.value;
```

The optional `schema` gives the data model a declared semantic vocabulary. When
it is set, objects, property sets and relationships in that `DataModel` must
either use the same schema or omit their own schema and inherit it.

---

## 3. Author Renderable Objects

Create geometry once, then create meshes and objects for the parts users will
pick and style.

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

function createBoxSceneObject(params) {
  const meshId = `${params.id}-mesh`;

  const meshResult = sceneModel.createMesh({
    id: meshId,
    geometryId: "unitBox",
    color: params.color,
    position: params.position,
    scale: params.scale
  });

  if (!meshResult.ok) {
    throw new Error(meshResult.error);
  }

  const objectResult = sceneModel.createObject({
    id: params.id,
    originalSystemId: params.originalSystemId,
    meshIds: [meshId]
  });

  if (!objectResult.ok) {
    throw new Error(objectResult.error);
  }
}

createBoxSceneObject({
  id: "building-01",
  originalSystemId: "asset:building:01",
  color: [0.74, 0.76, 0.72],
  position: [0, 0, 1.5],
  scale: [4.8, 3.2, 3.0]
});

createBoxSceneObject({
  id: "storey-01",
  originalSystemId: "asset:storey:01",
  color: [0.68, 0.72, 0.76],
  position: [0, 0, 0.7],
  scale: [4.9, 3.3, 1.2]
});

createBoxSceneObject({
  id: "wall-01",
  originalSystemId: "asset:wall:01",
  color: [0.82, 0.82, 0.78],
  position: [-2.2, 0, 0.9],
  scale: [0.25, 3.0, 1.4]
});

createBoxSceneObject({
  id: "window-01",
  originalSystemId: "asset:window:01",
  color: [0.16, 0.38, 0.62],
  position: [-2.34, -0.6, 1.0],
  scale: [0.08, 0.75, 0.42]
});
```

The IDs `building-01`, `storey-01`, `wall-01` and `window-01` are now visual
object IDs in the `Scene`. The next step creates matching semantic objects in
the `DataModel`.

---

## 4. Add Property Sets

A property set is a named group of typed values. Property sets can be attached
to one or more `DataObject`s by ID.

```javascript
const wallPropertiesResult = dataModel.createPropertySet({
  id: "pset-wall-01-common",
  name: "Wall Common",
  type: "PropertySet",
  properties: [
    {
      name: "IsExternal",
      valueType: "boolean",
      value: true
    },
    {
      name: "FireRating",
      type: "FireRating",
      valueType: "string",
      value: "60min"
    },
    {
      name: "LoadBearing",
      valueType: "boolean",
      value: true
    }
  ]
});

if (!wallPropertiesResult.ok) {
  throw new Error(wallPropertiesResult.error);
}

const windowPropertiesResult = dataModel.createPropertySet({
  id: "pset-window-01-common",
  name: "Window Common",
  type: "PropertySet",
  properties: [
    {
      name: "GlazingType",
      valueType: "string",
      value: "Double"
    },
    {
      name: "ThermalTransmittance",
      valueType: "number",
      value: 1.4
    }
  ]
});

if (!windowPropertiesResult.ok) {
  throw new Error(windowPropertiesResult.error);
}
```

Use property sets for values that should appear in property panels, search
indexes, exports or downstream analysis. `valueType` describes the stored value
kind, while `type` can preserve a semantic/source type such as an IFC property
type. Keep transient visual state, such as selection and x-ray, on
`ViewObject`s instead.

---

## 5. Create Matching DataObjects

Create one `DataObject` for each semantic object. For objects that are visible
and pickable, use the same ID as the corresponding `SceneObject`.

```javascript
function createDataObject(params) {
  const result = dataModel.createObject(params);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.value;
}

createDataObject({
  id: "building-01",
  originalSystemId: "ifc:2Y7Fv9",
  type: "Building",
  name: "Building 01"
});

createDataObject({
  id: "storey-01",
  originalSystemId: "ifc:0u1a2P",
  type: "BuildingStorey",
  name: "Ground Floor"
});

createDataObject({
  id: "wall-01",
  originalSystemId: "ifc:1H9mPv",
  type: "Wall",
  name: "External Wall 01",
  propertySetIds: ["pset-wall-01-common"]
});

createDataObject({
  id: "window-01",
  originalSystemId: "ifc:3bG8Km",
  type: "Window",
  name: "Window 01",
  propertySetIds: ["pset-window-01-common"]
});
```

The `originalSystemId` is optional. It is useful when your application needs to
round-trip to a source system whose IDs differ from xeokit's runtime IDs.

---

## 6. Connect the Semantic Graph

Relationships turn independent `DataObject`s into a graph. The common pattern
for spatial structure is a parent object that aggregates child objects.

```javascript
function createRelationship(params) {
  const result = dataModel.createRelationship(params);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.value;
}

createRelationship({
  type: "Aggregates",
  relatingObjectId: "building-01",
  relatedObjectId: "storey-01"
});

createRelationship({
  type: "Contains",
  relatingObjectId: "storey-01",
  relatedObjectId: "wall-01"
});

createRelationship({
  type: "Contains",
  relatingObjectId: "storey-01",
  relatedObjectId: "window-01"
});
```

The relationship type is application-defined unless you are following a specific
schema such as IFC or CityGML. Use stable relationship names because they become
part of traversal, filtering and export behavior.

---

## 7. Drive View State from Semantics

Because `SceneObject` and `DataObject` IDs match, semantic queries can directly
control rendered objects.

```javascript
const wallIds = [];

const searchResult = searchObjects(data, {
  startObjectId: "building-01",
  includeObjects: ["Wall"],
  includeStart: false,
  resultObjectIds: wallIds
});

if (!searchResult.ok) {
  throw new Error(searchResult.error);
}

view.setObjectsSelected(wallIds, true);
```

`searchObjects()` traverses relationships in the `Data` graph. The resulting IDs
are also `ViewObject` IDs, so they can be passed to view-state methods such as
`setObjectsSelected()`, `setObjectsHighlighted()`, `setObjectsXRayed()`,
`setObjectsVisible()` and `setObjectsColorized()`.

You can also go the other way after picking:

```javascript
function showPropertiesForPickedObject(pickResult) {
  const objectId = pickResult.objectId;
  const dataObject = data.objects[objectId];

  if (!dataObject) {
    return;
  }

  console.log(dataObject.name, dataObject.type);

  for (const propertySet of dataObject.propertySets || []) {
    console.group(propertySet.name);
    for (const property of propertySet.properties) {
      console.log(property.name, property.value);
    }
    console.groupEnd();
  }
}
```

Picking returns a visual object ID. Matching IDs make the property lookup a
simple map access instead of a separate translation step.

---

## 8. Rules of Thumb

Use the same ID for a `SceneObject` and `DataObject` when they represent the
same logical thing. This is the simplest and most useful convention for picking,
selection, property panels and semantic search.

Create `SceneObject`s only for things that need object-level interaction in the
viewer. A complex object can contain multiple `SceneMesh`es while still mapping
to one `DataObject`.

Create `DataObject`s for semantic nodes even when they have no geometry. Project
roots, sites, buildings, storeys, systems, zones and classifications often exist
only in the `DataModel`, yet are still useful for object trees and search.

Use property sets for persistent metadata and `ViewObject` state for temporary
presentation state. Selection, highlighting, x-ray, visibility, colorization and
opacity belong to the view; author, fire rating, classification and source IDs
belong to the semantic data model.

Set `schema` on the `DataModel` when the model should enforce one vocabulary.
Leave it unset when you are assembling heterogeneous data from several sources
and want to preserve each component's source schema.
