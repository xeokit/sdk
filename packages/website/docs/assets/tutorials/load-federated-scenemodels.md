---
title: Load Federated SceneModels
---

# Load Federated SceneModels

This tutorial shows how to load several XGF models into one xeokit viewer as a
federated project. Federation is the pattern to use when a project is delivered
as separate model packages: architecture, structure, site, MEP, annotations,
survey context, temporary works or design options.

The important concept is that federation is a runtime composition problem:

- `Scene` is the shared renderable container. It owns the global object index
  used by picking, view state and renderer registration.
- Each loaded `SceneModel` is one visual package inside that scene. It can be
  loaded, unloaded, inspected and replaced independently.
- Each loaded `DataModel` is the semantic companion for one visual package. It
  contains object types, names, property sets and relationships.
- `View` presents the shared scene. Selection, visibility, highlighting, x-ray,
  colorization and opacity are per-view `ViewObject` state, even when the
  underlying `SceneObject`s come from many models.

The viewer does not need one giant file. It can load a set of XGF/DataModel JSON
pairs, keep their package boundaries, and still let users search, pick and
filter across the combined project.

---

## 1. Prepare a Federated Model Manifest

Use a manifest to describe the packages that belong to the project. Each entry
points to one XGF file and, optionally, one DataModel JSON file.

```javascript
const federatedManifest = [
  {
    id: "site",
    name: "Site Context",
    layerId: "site",
    xgfUrl: "./models/federated/site/model.xgf",
    dataModelUrl: "./models/federated/site/datamodel.json",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  },
  {
    id: "architecture",
    name: "Architecture",
    layerId: "architecture",
    xgfUrl: "./models/federated/architecture/model.xgf",
    dataModelUrl: "./models/federated/architecture/datamodel.json",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  },
  {
    id: "mep",
    name: "Mechanical Services",
    layerId: "mep",
    xgfUrl: "./models/federated/mep/model.xgf",
    dataModelUrl: "./models/federated/mep/datamodel.json",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  }
];
```

Keep model identity in the manifest. The model ID becomes the `SceneModel.id`,
the `DataModel.id`, the package key in your application state, and the natural
place to store per-model UI state such as loading status.

---

## 2. Decide the Object ID Policy

Federated projects need globally unique object IDs in the shared `Scene`.
There are two common policies:

- **Already-federated IDs**: the XGF and DataModel JSON already contain IDs such
  as `architecture.wall-01` and `mep.wall-01`. Create the runtime `SceneModel`
  with `globalizedIds: false`.
- **Local source IDs**: each package contains local IDs such as `wall-01`.
  Create the runtime `SceneModel` with `globalizedIds: true`, which registers
  loaded `SceneObject`s as `<SceneModel.id>.<localObjectId>`.

The `DataModelImporter` does not automatically prefix object IDs. If you load
XGF with `globalizedIds: true`, the matching DataModel JSON should already use
the same prefixed IDs that the viewer will see, or your application needs a
small ID-mapping layer.

This tutorial assumes the XGF files contain local source IDs and the DataModel
JSON files contain matching prefixed IDs.

---

## 3. Create the Viewer

Create one `Scene`, one `Viewer`, one renderer, and one or more `View`s.

```javascript
import {Data, searchObjects} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";

function valueFrom(result, operation) {
  if (!result.ok) {
    throw new Error(`${operation}: ${result.error}`);
  }
  return result.value;
}

const scene = new Scene({
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

const data = new Data();
const viewer = new Viewer({scene});

const view = valueFrom(viewer.createView({
  id: "main",
  htmlElement: document.getElementById("viewerCanvas"),
  backgroundColor: [0.93, 0.95, 0.98],
  camera: {
    eye: [18, -22, 14],
    look: [0, 0, 2],
    up: [0, 0, 1]
  }
}), "create main view");

new WebGLRenderer({viewer});
new ModelNavigationController(view);
```

All loaded models go into the same `Scene`. The view will get a `ViewObject` for
each loaded `SceneObject`.

---

## 4. Load One Federated Package

Create an empty `SceneModel` and `DataModel`, then load the files into them.

```javascript
const xgfLoader = new XGFLoader();
const dataModelImporter = new DataModelImporter();

async function loadFederatedPackage(entry) {
  const sceneModel = valueFrom(scene.createModel({
    id: entry.id,
    layerId: entry.layerId,
    globalizedIds: true,
    coordinateSystem: entry.coordinateSystem,
    memoryPolicy: "compact"
  }), `create SceneModel ${entry.id}`);

  const dataModel = valueFrom(data.createModel({
    id: entry.id,
    name: entry.name
  }), `create DataModel ${entry.id}`);

  const [xgfBuffer, dataModelParams] = await Promise.all([
    fetchArrayBuffer(entry.xgfUrl),
    entry.dataModelUrl ? fetchJSON(entry.dataModelUrl) : null
  ]);

  await xgfLoader.load({
    fileData: xgfBuffer,
    sceneModel
  });

  if (dataModelParams) {
    await dataModelImporter.load({
      fileData: dataModelParams,
      dataModel
    });
  }

  const sealResult = sceneModel.seal();

  if (!sealResult.ok) {
    throw new Error(sealResult.error);
  }

  return {
    ...entry,
    sceneModel,
    dataModel
  };
}

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

Create the `SceneModel` before loading because `XGFLoader` writes into an
existing model. Call `seal()` after loading when the package is complete and
should reject later topology changes.

---

## 5. Load the Full Federation

Load all packages and keep their handles in application state.

```javascript
const loadedPackages = [];

for (const entry of federatedManifest) {
  const loaded = await loadFederatedPackage(entry);
  loadedPackages.push(loaded);
}

console.log("Loaded models:", Object.keys(scene.models).length);
console.log("Loaded scene objects:", Object.keys(scene.objects).length);
console.log("Loaded data models:", Object.keys(data.models).length);
console.log("Loaded data objects:", Object.keys(data.objects).length);
```

Loading sequentially gives simple progress reporting and predictable failure
handling. For independent packages, you can load several at once with
`Promise.all`, then register application UI state as each package resolves.

---

## 6. Validate Loaded Packages

Run the scene and data inspectors after load. This catches bad packages before
users interact with them.

```javascript
import {
  inspectDataModel,
  inspectionReportToJson as dataInspectionReportToJson
} from "@xeokit/sdk/quality/dataModel";
import {
  inspectSceneModel,
  inspectionReportToJson as sceneInspectionReportToJson
} from "@xeokit/sdk/quality/sceneModel";

function assertNoErrors(report, label) {
  if (report.errors.length > 0) {
    throw new Error(
      `${label}:\n` +
      report.errors.map((issue) => `${issue.code}: ${issue.message}`).join("\n")
    );
  }
}

for (const pkg of loadedPackages) {
  const sceneReport = inspectSceneModel({
    sceneModel: pkg.sceneModel,
    checkGeometryArrayLengths: true,
    checkObjectStructure: true
  });

  assertNoErrors(sceneReport, `${pkg.id} SceneModel`);

  const dataReport = inspectDataModel({
    dataModel: pkg.dataModel,
    checkSchemaTagging: true,
    checkRelationshipCycles: true
  });

  assertNoErrors(dataReport, `${pkg.id} DataModel`);

  console.log(pkg.id, {
    scene: sceneInspectionReportToJson(sceneReport).counts,
    data: dataInspectionReportToJson(dataReport).counts
  });
}
```

Inspect each package independently. A problem in the MEP package should not be
reported as a vague whole-project failure when the package boundary already
tells you where to look.

---

## 7. Check Scene/Data Alignment

If your application expects every pickable object to have metadata, validate
that the shared scene object index and shared data object index agree.

```javascript
const sceneObjectsWithoutData = [];

for (const objectId of Object.keys(scene.objects)) {
  if (!data.objects[objectId]) {
    sceneObjectsWithoutData.push(objectId);
  }
}

if (sceneObjectsWithoutData.length > 0) {
  throw new Error(
    `SceneObjects without DataObjects: ${sceneObjectsWithoutData.join(", ")}`
  );
}
```

This is an application policy check. Some projects intentionally load helper
geometry, measurement markup or visual-only context without semantic data.

---

## 8. Select Across Loaded Models

Search the shared `Data` root, then apply view state to the resulting object
IDs.

```javascript
const serviceObjectIds = [];

const searchResult = searchObjects(data, {
  includeObjects: ["DuctSegment"],
  resultObjectIds: serviceObjectIds
});

if (!searchResult.ok) {
  throw new Error(searchResult.error);
}

view.setObjectsSelected(serviceObjectIds, true);
```

Because the object IDs are federated, this works across package boundaries. The
same IDs can be passed to `setObjectsVisible`, `setObjectsHighlighted`,
`setObjectsXRayed`, `setObjectsColorized`, `setObjectsOpacity`,
`setObjectsPickable` and `setObjectsClippable`.

---

## 9. Toggle Packages by Layer

Use layers when the UI needs discipline toggles or package-level controls.

```javascript
function setPackageVisible(packageId, visible) {
  const pkg = loadedPackages.find((candidate) => candidate.id === packageId);

  if (!pkg) {
    throw new Error(`Package not loaded: ${packageId}`);
  }

  const objectIds = Object.keys(pkg.sceneModel.objects);
  view.setObjectsVisible(objectIds, visible);
}

setPackageVisible("mep", false);
```

This preserves the loaded model and metadata while hiding its current view
objects. Use unload only when you want to release the model package.

---

## 10. Unload a Package

Destroy the visual and semantic models together when a package is no longer
needed.

```javascript
function unloadPackage(packageId) {
  const index = loadedPackages.findIndex((pkg) => pkg.id === packageId);

  if (index < 0) {
    return;
  }

  const [pkg] = loadedPackages.splice(index, 1);
  const sceneDestroy = pkg.sceneModel.destroy();

  if (!sceneDestroy.ok) {
    throw new Error(sceneDestroy.error);
  }

  const dataDestroy = pkg.dataModel.destroy();

  if (!dataDestroy.ok) {
    throw new Error(dataDestroy.error);
  }
}

unloadPackage("mep");
```

`SceneModel.destroy()` removes that model's objects from the shared `Scene`
index. `DataModel.destroy()` removes the matching semantic objects from the
shared `Data` index. Keep the two lifecycles paired unless your application
explicitly supports geometry-only or metadata-only packages.
