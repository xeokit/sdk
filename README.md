# @xeokit SDK (V3)

> **High‑performance AECO visualization for the web and Node.js**

Welcome to **xeokit**, a flexible, production‑grade SDK for creating fast, interactive visualizations of AECO (Architecture, Engineering, Construction & Operations) models directly in the browser or in Node.js.

Built with **TypeScript**, xeokit is designed for **extreme performance**: it streams, loads, and renders very large models with minimal memory and CPU usage. The SDK cleanly separates **data**, **scene representation**, and **rendering**, making it suitable for everything from lightweight viewers to complex BIM pipelines.

---

## Key Features

* **Lightning‑fast rendering** of massive AECO models using innovative 
* **Browser & Node.js support** for viewing, conversion, and preprocessing
* **Scene graph + data graph** architecture
* **Multi‑canvas, multi‑view viewers**
* **Full precision (64-bit) coordinate system**
* **Pluggable renderer backends** (WebGL today, WebGPU ready)
* **Import, export & convert** industry‑standard AECO formats
* **BIM collaboration** via BCF Viewpoints
* **Fully documented utility libraries**
* **Open‑source** with a permissive AGPL‑3.0 license**

---

## Table of Contents

#### [Modules](#modules)
  - [Scene Graph](#scene-graph)
  - [Data Graph](#data-graph)
  - [Model Viewer & Renderer](#model-viewer--renderer-backend)
  - [Importers & Exporters](#model-importers-and-exporters)
  - [Model Conversion](#model-conversion)
  - [BIM Interoperability (BCF)](#bim-interoperability-via-bcf-viewpoints)

#### [Examples](#examples)
  - [Spinning 3D Box](#spinning-3d-box)
  - [IFC Model Viewer](#ifc-model-viewer)
  - [IFC to DotBIM Conversion via CLI](#converting-an-ifc-file-to-dotbim-via-cli)

#### [Project Development](#project-development)
  - [Installation](#installation)
  - [Building the SDK](#build-sdk)
  - [Generating Docs](#build-typedocs)

#### [License](#license)
#### [Credits](#credits)

---


## Modules

### Scene Graph

The **scene graph** represents 3D model geometry, materials, and objects. It is renderer‑agnostic and works identically in the browser and Node.js. You can use it to:

* Build models programmatically
* Convert between file formats
* Drive one or more viewers

The scene graph emits events for every structural or visual change.

| Module                                                                              | Description                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`@xeokit/sdk/scene`](https://xeokit.github.io/sdk/docs/api/modules/scene.html) | Scene graph containing geometries, materials, and objects |

---

### Data Graph

The **data graph** manages model semantics using an entity‑relationship structure. It stores:

* Entities
* Properties
* Relationships

Like the scene graph, it runs in both browser and Node.js environments and emits change events independently of rendering.

| Module                                                                                | Description                        |
|---------------------------------------------------------------------------------------| ---------------------------------- |
| [`@xeokit/sdk/data`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_data.html) | Semantic entity‑relationship graph |

---

### Model Viewer & Renderer Backend

xeokit includes a high‑performance **browser viewer** that attaches to a scene graph and reacts to its events in real time.

Rendering is handled by **pluggable backends**, allowing support for multiple graphics APIs.

Key capabilities:

* Multiple simultaneous models
* Multiple canvases and views
* Cameras, lights, section planes, annotations
* UI widgets and localization

| Module                                                                                              | Description                 |
| --------------------------------------------------------------------------------------------------- | --------------------------- |
| [`@xeokit/sdk/viewer`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_viewer.html)               | Browser‑based model viewer  |
| [`@xeokit/sdk/webglrenderer`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_webglrenderer.html) | WebGL rendering backend     |
| [`@xeokit/sdk/cameracontrol`](https://xeokit.github.io/sdk/docs/api/modules/cameracontrol.html)         | Interactive camera controls |
| [`@xeokit/sdk/treeview`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_treeview.html)           | HTML tree view widget       |
| [`@xeokit/sdk/locale`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_locale.html)               | Localization service        |

---

### Model Importers and Exporters

xeokit supports several industry‑standard AECO formats. These modules can be used in:

* Node.js (offline conversion pipelines)
* Browsers (runtime loading)

| Module                                                                                              | Description             |
| --------------------------------------------------------------------------------------------------- | ----------------------- |
| [`@xeokit/sdk/formats/dotbim`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_dotbim.html)       | Import/export DotBIM    |
| [`@xeokit/sdk/formats/xgf`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_xgf.html)             | Import/export XGF       |
| [`@xeokit/sdk/formats/gltf`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_gltf.html)           | Import glTF / GLB       |
| [`@xeokit/sdk/formats/las`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_las.html)             | Import LAS point clouds |
| [`@xeokit/sdk/formats/cityjson`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_cityjson.html)   | Import CityJSON         |
| [`@xeokit/sdk/formats/ifc`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_webifc.html)          | Import IFC              |
| [`@xeokit/sdk/formats/xkt`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_xkt.html)             | Import XKT              |
| [`@xeokit/sdk/formats/datamodel`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_datamodel.html) | Native data models      |
| [`@xeokit/sdk/formats/scenedata`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_scenedata.html) | Native scene models     |

---

### Model Conversion

Convert between multiple AECO formats using a unified API or CLI.

| Module                                                                                                | Description            |
| ----------------------------------------------------------------------------------------------------- | ---------------------- |
| [`@xeokit/sdk/modelconverter`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_modelconverter.html) | Multi‑format converter |
| [`@xeokit/sdk/xeoconvert`](https://xeokit.github.io/sdk/docs/api/modules/_xeokit_xeoconvert.html)         | CLI wrapper            |

---

### BIM Interoperability via BCF Viewpoints

Share viewer state and issues with other BIM tools using **BCF Viewpoints**, enabling collaborative workflows across platforms.

| Module                                                             | Description                  |
| ------------------------------------------------------------------ | ---------------------------- |
| [`@xeokit/sdk/bcf`](https://www.npmjs.com/package/@xeokit/sdk/bcf) | Load and save BCF Viewpoints |

---

## Examples

Some minimal examples to get you started. Find more examples 
at [xeokit.github.io/sdk/examples](https://xeokit.github.io/sdk/examples/).

### Spinning 3D Box

In the example below, we create a simple 3D box model and set up a viewer to display it in a canvas
element with the ID `myCanvas`. The camera orbits around the box to create a spinning effect.

In xeokit, everything starts with a **Scene** that holds all 3D content. We then create
a **Viewer** to visualize the scene, and a **WebGLRenderer** to handle rendering.

Instead of using exceptions, errors are handled gracefully using result monads. Any method in the SDK that can
fail returns an `SDKResult` that indicates success or failure.

Scene content is fully dynamic and can be modified at runtime. We can create and destroy 
geometries, meshes, and objects in the Scene and the Viewer will update automatically.

Everything is coupled via events. The Scene emits events when content changes; the Viewer 
emits events when viewing parameters change, and the WebGLRenderer reacts to all these events
to update the display accordingly.

```bash
npm install @xeokit/sdk
```

```javascript
import { Scene } from "@xeokit/sdk/scene";
import { Viewer } from "@xeokit/sdk/viewer";
import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
import { SDKTask } from "@xeokit/sdk/core";
import { TrianglesPrimitive } from "@xeokit/sdk/constants";

const scene = new Scene();
const viewer = new Viewer({ scene });
const renderer = new WebGLRenderer({ viewer });

const viewResult = viewer.createView({ 
  id: "view", 
  elementId: "myCanvas" 
});

if (!viewResult.ok) {
  throw new Error(viewResult.error);
}

const view = viewResult.value

view.camera.eye = [0, 0, 10];
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];

const modelResult = scene.createModel({
  id: "boxModel"
});

if (!modelResult.ok) {
  throw new Error(modelResult.error);
}

const model = modelResult.value;

model.createGeometry({
  id: "boxGeometry",
  primitive: TrianglesPrimitive,
  positions: [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1],
  indices: [0, 1, 2, 0, 2, 3]
});

model.addMesh({ 
  id: "boxMesh", 
  geometryId: "boxGeometry", 
  color: [1, 0, 0] 
});

model.createObject({ 
  id: "box", 
  meshIds: ["boxMesh"] 
});

new SDKTask({
  repeat: true,
  task: () => view.camera.orbitYaw(1)
});
```

---

### IFC Model Viewer

Load and display a IFC model in the browser, including semantic structure via the data graph.

```javascript
import { Scene } from "@xeokit/sdk/scene";
import { Data, searchObjects } from "@xeokit/sdk/data";
import { Viewer } from "@xeokit/sdk/viewer";
import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
import { CameraControl } from "@xeokit/sdk/cameracontrol";
import { IFCLoader } from "@xeokit/sdk/formats/dotbim";

// Create containers for geometry and optional structural data

const scene = new Scene();
const data = new Data();

// Create a Viewer and WebGL renderer

const viewer = new Viewer({ scene });
new WebGLRenderer({ viewer });

// Create a View bound to an existing canvas element

const view = viewer.createView({
    id: "myView",
    elementId: "myCanvas" // Ensure this element exists
}).value;

// Position the camera

view.camera.eye = [-6.01, 4.85, 9.11];
view.camera.look = [3.93, -2.65, -12.51];
view.camera.up = [0.12, 0.95, -0.27];

// Enable mouse / touch camera interaction

new CameraControl(view, {});

// Create target models for the loader

const sceneModel = scene.createModel({ id: "myModel" }).value;
const dataModel = data.createModel({ id: "myModel" }).value;

// Create the IFC loader

const ifcLoader = new IFCLoader();

// Fetch and decode the IFC file

fetch("model.ifc")
    .then((r) => r.arrayBuffer())
    .then((fileData) => {
 
        // Load geometry (and optional node hierarchy) into the models
 
        return ifcLoader.load({
            fileData,
            sceneModel,
            dataModel
        });
    })
    .then(() => {
        
        // Model successfully loaded and visible.

        // Search the data graph for IfcWall objects, starting at the 
        // IfcProject root node, including any children via IfcRelAggregates relationships.
      
      const resultObjectIds = [];

      const result = searchObjects(data, {
        startObjectId: "38aOKO8_DDkBd1FHm_lVXz", // Root IfcProject ID
        includeObjects: ["IfcWall"],
        includeRelated: ["IfcRelAggregates"],
        resultObjectIds
      });

      // Check if the query succeeded.

      if (!result.ok) {
        console.error("Error querying IFC data: " + result.error);
        return;
      }

      // If the query succeeded, go ahead and mark whatever
      // objects we found as selected. Now all the IfcWall objects
      // in the Viewer will appear selected and glowing.

      view.setObjectsSelected(resultObjectIds, true);
    })
    .catch((err) => {
        // Clean up on failure
        sceneModel.destroy();
        dataModel.destroy();
        console.error("Error loading IFC:", err);
    });
```

---

### Converting an IFC file to DotBIM via CLI

Convert an IFC file to DotBIM format using the `xeoconvert` command-line tool.

```bash
node ./node_modules/@xeokit/sdk/dist/xeoconvert.js \
  --pipeline ifc2dotbim \
  --ifc model.ifc \
  --dotbim model.bim \
  --log \
  --stats conversion_stats.json
```

---

## Project Development

### Installation

Install the package manager (recommended globally):

````

Clone the repository:

```bash
git clone https://github.com/xeokit/sdk
cd sdk
````

Install dependencies:

```bash
pnpm install
```

---

### Build SDK

Build the xeokit SDK:

```bash
pnpm sdk-dist
```

Output:

```
./packages/sdk/dist
```

This directory contains the compiled JavaScript bundles and dependencies.

---

### Build TypeDocs

Generate API documentation:

```bash
pnpm website-sdk-docs
```

Output:

```
./packages/website/docs
```

The `website` package is configured as the root for GitHub Pages hosting.

---

## License

Copyright © 2026

Licensed under the **AGPL‑3.0**.

---

## Credits

See [Credits](/credits.html).
