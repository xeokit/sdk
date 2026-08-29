---
title: Author SceneModel Metadata and Property Workflows
---

# Author SceneModel Metadata and Property Workflows

This tutorial shows how to build the metadata layer that makes an authored
`SceneModel` useful in an application. Geometry makes the model visible.
Metadata makes it searchable, filterable, inspectable and exportable with
domain meaning.

xeokit keeps visual and semantic data separate:

- `SceneModel` owns the renderable content: geometries, materials, meshes and
  `SceneObject`s.
- `SceneObject` is the thing a user picks, selects, hides or highlights in a
  `View`.
- `DataModel` owns the semantic graph: `DataObject`s, `PropertySet`s and typed
  `Relationship`s.
- A shared object ID connects both sides. When `SceneObject.id` and
  `DataObject.id` match, picking a visual object can open the matching property
  panel immediately.

The key design choice is ID policy. Decide which objects are selectable, assign
them stable IDs, then use those same IDs in the `DataModel`. Keep source-system
IDs in `originalSystemId` when you need to round-trip back to IFC, CAD, PLM or
another external system.

[![Authored table with semantic data](https://xeokit.github.io/sdk/examples/create/data/table-with-semantics/index.png)](https://xeokit.github.io/sdk/examples/index.html#create/data/table-with-semantics)

The live
[Creating a Model with Semantic Data](https://xeokit.github.io/sdk/examples/index.html#create/data/table-with-semantics)
example shows stable IDs connecting renderable objects with semantic data.

---

## 1. Create Matching Scene and Data Models

Create the visual and semantic models with the same model ID. This is not a
hard SDK requirement, but it makes files, logs and loaded model pairs easy to
manage.

```javascript
import {mkdir, writeFile} from "node:fs/promises";
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Data, searchObjects} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {DataModelExporter} from "@xeokit/sdk/formats/datamodel";
import {XGFExporter} from "@xeokit/sdk/formats/xgf";
import {
  inspectDataModel,
  inspectionReportToJson as dataInspectionReportToJson
} from "@xeokit/sdk/quality/dataModel";
import {
  inspectSceneModel,
  inspectionReportToJson as sceneInspectionReportToJson
} from "@xeokit/sdk/quality/sceneModel";

function valueFrom(result, operation) {
  if (!result.ok) {
    throw new Error(`${operation}: ${result.error}`);
  }
  return result.value;
}

const scene = new Scene();
const data = new Data();

const sceneModel = valueFrom(scene.createModel({
  id: "metadata-building",
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
}), "create SceneModel");

const dataModel = valueFrom(data.createModel({
  id: "metadata-building",
  name: "Metadata Building",
  schema: "ExampleBuilding/v1",
  author: "xeokit tutorial",
  creatingApplication: "programmatic-authoring"
}), "create DataModel");
```

The `schema` string declares the vocabulary used by the `DataModel`. When it is
set, objects, property sets and relationships created inside the model must use
that schema or omit their own schema and inherit it.

---

## 2. Use a Stable Object ID Policy

Define IDs once and feed the same records into the scene and data authoring
steps.

```javascript
const elements = [
  {
    id: "building-01",
    sourceId: "ifc:2Y7Fv9",
    type: "Building",
    name: "Building 01",
    position: [0, 0, 1.5],
    scale: [5.0, 3.4, 3.0],
    color: [0.72, 0.74, 0.70]
  },
  {
    id: "storey-01",
    sourceId: "ifc:0u1a2P",
    type: "BuildingStorey",
    name: "Ground Floor",
    position: [0, 0, 0.65],
    scale: [5.1, 3.5, 1.1],
    color: [0.66, 0.70, 0.74]
  },
  {
    id: "wall-01",
    sourceId: "ifc:1H9mPv",
    type: "Wall",
    name: "External Wall 01",
    position: [-2.35, 0, 1.0],
    scale: [0.25, 3.2, 1.6],
    color: [0.82, 0.82, 0.78],
    propertySetIds: ["pset-wall-common", "pset-wall-fire"]
  },
  {
    id: "window-01",
    sourceId: "ifc:3bG8Km",
    type: "Window",
    name: "Window 01",
    position: [-2.5, -0.7, 1.05],
    scale: [0.08, 0.85, 0.48],
    color: [0.18, 0.42, 0.66],
    propertySetIds: ["pset-window-common"]
  }
];
```

Use project-stable IDs for `id`. Use `originalSystemId` for IDs owned by another
system. That lets your application change runtime IDs if needed without losing
the reference back to the source data.

---

## 3. Author Selectable SceneObjects

Create one `SceneObject` for each element users should be able to pick or
control. Each object can own one or more meshes.

```javascript
valueFrom(sceneModel.createGeometry({
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
}), "create unitBox geometry");

for (const element of elements) {
  const meshId = `${element.id}-mesh`;

  valueFrom(sceneModel.createMesh({
    id: meshId,
    geometryId: "unitBox",
    color: element.color,
    position: element.position,
    scale: element.scale
  }), `create mesh ${meshId}`);

  valueFrom(sceneModel.createObject({
    id: element.id,
    originalSystemId: element.sourceId,
    meshIds: [meshId]
  }), `create SceneObject ${element.id}`);
}
```

Do not create a `SceneObject` for every triangle or draw helper unless users
need to interact with it as an object. Object count affects picking, state
updates, filtering and application memory.

---

## 4. Define Reusable Property Sets

Property sets hold structured values that can be shown in a property panel,
indexed for search or exported with the model.

```javascript
valueFrom(dataModel.createPropertySet({
  id: "pset-wall-common",
  name: "Wall Common",
  type: "PropertySet",
  properties: [
    {
      name: "IsExternal",
      valueType: "boolean",
      value: true
    },
    {
      name: "LoadBearing",
      valueType: "boolean",
      value: true
    }
  ]
}), "create wall common property set");

valueFrom(dataModel.createPropertySet({
  id: "pset-wall-fire",
  name: "Wall Fire Performance",
  type: "PropertySet",
  properties: [
    {
      name: "FireRating",
      valueType: "string",
      value: "60min"
    }
  ]
}), "create wall fire property set");

valueFrom(dataModel.createPropertySet({
  id: "pset-window-common",
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
}), "create window property set");
```

Property set IDs are reusable references. Attach the same property set to
multiple objects when it represents shared classification or specification
data. Create separate property sets when each object has different measured
values.

---

## 5. Create Matching DataObjects

Create semantic objects using the same IDs as the selectable scene objects.

```javascript
for (const element of elements) {
  valueFrom(dataModel.createObject({
    id: element.id,
    originalSystemId: element.sourceId,
    type: element.type,
    name: element.name,
    propertySetIds: element.propertySetIds
  }), `create DataObject ${element.id}`);
}
```

`DataObject.type` is the main classification field. Keep it stable because it
drives search, filtering, tree grouping, schema checks and relationship rules.

---

## 6. Add Relationships for Navigation

Relationships define how users and tools traverse the semantic graph.

```javascript
function createRelationship(type, relatingObjectId, relatedObjectId) {
  valueFrom(dataModel.createRelationship({
    type,
    relatingObjectId,
    relatedObjectId
  }), `create ${type} relationship ${relatingObjectId} -> ${relatedObjectId}`);
}

createRelationship("Aggregates", "building-01", "storey-01");
createRelationship("Contains", "storey-01", "wall-01");
createRelationship("Contains", "storey-01", "window-01");
```

Use relationships for domain structure, not for renderer state. Containment,
aggregation, system membership and classification links belong in the
`DataModel`. Visibility, x-ray, highlighting and selection belong in the
viewer.

---

## 7. Query Metadata and Select Matching Objects

Use `searchObjects` to traverse the semantic graph and collect object IDs. In a
viewer, pass those IDs to view-state methods. This snippet assumes your
application already has a `View` named `view`.

```javascript
const containedWalls = [];

const searchResult = searchObjects(data, {
  startObjectId: "storey-01",
  includeObjects: ["Wall"],
  includeRelated: ["Contains"],
  resultObjectIds: containedWalls
});

if (!searchResult.ok) {
  throw new Error(searchResult.error);
}

view.setObjectsHighlighted(containedWalls, true);
```

This pattern keeps application logic clear: semantic queries return object IDs,
and view code applies rendering state to those IDs.

---

## 8. Validate Scene and Metadata Alignment

Check that every selectable `SceneObject` has a matching `DataObject`, then run
the scene and data inspectors.

```javascript
const sceneObjectsWithoutData = [];

for (const objectId of Object.keys(sceneModel.objects)) {
  if (!dataModel.objects[objectId]) {
    sceneObjectsWithoutData.push(objectId);
  }
}

if (sceneObjectsWithoutData.length > 0) {
  throw new Error(
    `SceneObjects without DataObjects: ${sceneObjectsWithoutData.join(", ")}`
  );
}

const sceneReport = inspectSceneModel({
  sceneModel,
  checkGeometryQuality: true
});

if (sceneReport.errors.length > 0) {
  throw new Error(
    sceneReport.errors.map((issue) => issue.message).join("\n")
  );
}

const schema = {
  id: "ExampleBuilding/v1",
  objectTypes: {
    Building: {label: "Building"},
    BuildingStorey: {label: "Building Storey"},
    Wall: {
      label: "Wall",
      requiredPropertySets: ["pset-wall-common"]
    },
    Window: {
      label: "Window",
      requiredPropertySets: ["pset-window-common"]
    }
  },
  relationshipTypes: {
    Aggregates: {
      allowedRelatingTypes: ["Building"],
      allowedRelatedTypes: ["BuildingStorey"]
    },
    Contains: {
      allowedRelatingTypes: ["BuildingStorey"],
      allowedRelatedTypes: ["Wall", "Window"]
    }
  }
};

const dataReport = inspectDataModel({
  dataModel,
  schema,
  checkSchemaTagging: true,
  checkRelationshipTypeBinding: true,
  checkRelationshipCycles: true,
  cycleRelationshipTypes: ["Aggregates", "Contains"]
});

if (dataReport.errors.length > 0) {
  throw new Error(
    dataReport.errors.map((issue) => issue.message).join("\n")
  );
}
```

Use schema-aware checks for project rules that matter to downstream workflows:
allowed object types, required property sets, allowed relationship endpoints and
cycle-free containment.

---

## 9. Export XGF and DataModel JSON Together

Export the visual model and semantic graph as a matched pair.

```javascript
await mkdir("dist/metadata-building", {recursive: true});

await writeFile(
  "dist/metadata-building/scene-inspection.json",
  JSON.stringify(sceneInspectionReportToJson(sceneReport), null, 2)
);

await writeFile(
  "dist/metadata-building/data-inspection.json",
  JSON.stringify(dataInspectionReportToJson(dataReport), null, 2)
);

const xgfBuffer = await new XGFExporter().write({
  sceneModel
});

const dataModelParams = await new DataModelExporter().write({
  dataModel
});

await writeFile("dist/metadata-building/model.xgf", Buffer.from(xgfBuffer));
await writeFile(
  "dist/metadata-building/datamodel.json",
  JSON.stringify(dataModelParams, null, 2)
);
```

Keep the XGF and DataModel JSON filenames together in your manifest or model
registry. A viewer can load only the XGF when it needs geometry, or load both
files when it needs object trees, property panels, semantic filtering and
source-system references.
