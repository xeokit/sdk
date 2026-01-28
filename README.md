# @xeokit SDK (V3)

> **High‑performance AECO visualization for the web and Node.js**

Welcome to **xeokit**, a flexible, production‑grade SDK for creating fast, interactive visualizations of AECO (Architecture, Engineering, Construction & Operations) models directly in the browser or in Node.js.

Built with **TypeScript**, xeokit is designed for **extreme performance**: it streams, loads, and renders very large models with minimal memory and CPU usage. The SDK cleanly separates **data**, **scene representation**, and **rendering**, making it suitable for everything from lightweight viewers to complex BIM pipelines.

---

## Key Features

* **Lightning‑fast rendering** of massive AECO models
* **Browser & Node.js support** for viewing, conversion, and preprocessing
* **Scene graph + data graph** architecture
* **Multi‑canvas, multi‑view viewers**
* **Pluggable renderer backends** (WebGL today, WebGPU ready)
* **Import, export & convert** industry‑standard AECO formats
* **BIM collaboration** via BCF Viewpoints
* **Fully documented utility libraries**

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
  - [DotBIM Model Viewer](#dotbim-model-viewer)
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
| [`@xeokit/sdk/scene`](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html) | Scene graph containing geometries, materials, and objects |

---

### Data Graph

The **data graph** manages model semantics using an entity‑relationship structure. It stores:

* Entities
* Properties
* Relationships

Like the scene graph, it runs in both browser and Node.js environments and emits change events independently of rendering.

| Module                                                                            | Description                        |
| --------------------------------------------------------------------------------- | ---------------------------------- |
| [`@xeokit/sdk/data`](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html) | Semantic entity‑relationship graph |

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
| [`@xeokit/sdk/viewer`](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html)               | Browser‑based model viewer  |
| [`@xeokit/sdk/webglrenderer`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webglrenderer.html) | WebGL rendering backend     |
| [`@xeokit/sdk/cameracontrol`](https://xeokit.github.io/sdk/docs/modules/cameracontrol.html)         | Interactive camera controls |
| [`@xeokit/sdk/treeview`](https://xeokit.github.io/sdk/docs/modules/_xeokit_treeview.html)           | HTML tree view widget       |
| [`@xeokit/sdk/locale`](https://xeokit.github.io/sdk/docs/modules/_xeokit_locale.html)               | Localization service        |

---

### Model Importers and Exporters

xeokit supports several industry‑standard AECO formats. These modules can be used in:

* Node.js (offline conversion pipelines)
* Browsers (runtime loading)

| Module                                                                                              | Description             |
| --------------------------------------------------------------------------------------------------- | ----------------------- |
| [`@xeokit/sdk/formats/dotbim`](https://xeokit.github.io/sdk/docs/modules/_xeokit_dotbim.html)       | Import/export DotBIM    |
| [`@xeokit/sdk/formats/xgf`](https://xeokit.github.io/sdk/docs/modules/_xeokit_xgf.html)             | Import/export XGF       |
| [`@xeokit/sdk/formats/gltf`](https://xeokit.github.io/sdk/docs/modules/_xeokit_gltf.html)           | Import glTF / GLB       |
| [`@xeokit/sdk/formats/las`](https://xeokit.github.io/sdk/docs/modules/_xeokit_las.html)             | Import LAS point clouds |
| [`@xeokit/sdk/formats/cityjson`](https://xeokit.github.io/sdk/docs/modules/_xeokit_cityjson.html)   | Import CityJSON         |
| [`@xeokit/sdk/formats/ifc`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webifc.html)          | Import IFC              |
| [`@xeokit/sdk/formats/xkt`](https://xeokit.github.io/sdk/docs/modules/_xeokit_xkt.html)             | Import XKT              |
| [`@xeokit/sdk/formats/datamodel`](https://xeokit.github.io/sdk/docs/modules/_xeokit_datamodel.html) | Native data models      |
| [`@xeokit/sdk/formats/scenedata`](https://xeokit.github.io/sdk/docs/modules/_xeokit_scenedata.html) | Native scene models     |

---

### Model Conversion

Convert between multiple AECO formats using a unified API or CLI.

| Module                                                                                                | Description            |
| ----------------------------------------------------------------------------------------------------- | ---------------------- |
| [`@xeokit/sdk/modelconverter`](https://xeokit.github.io/sdk/docs/modules/_xeokit_modelconverter.html) | Multi‑format converter |
| [`@xeokit/sdk/xeoconvert`](https://xeokit.github.io/sdk/docs/modules/_xeokit_xeoconvert.html)         | CLI wrapper            |

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

A minimal example showing how to create a scene, viewer, and animated object.

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

const view = viewer.createView({ id: "view", elementId: "myCanvas" }).value;

view.camera.eye = [0, 0, 10];
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];

const model = scene.createModel().value;

model.createGeometry({
  id: "boxGeometry",
  primitive: TrianglesPrimitive,
  positions: [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1],
  indices: [0, 1, 2, 0, 2, 3]
});

model.addMesh({ id: "boxMesh", geometryId: "boxGeometry", color: [1, 0, 0] });
model.createObject({ id: "box", meshIds: ["boxMesh"] });

new SDKTask({
  repeat: true,
  task: () => view.camera.orbitYaw(1)
});
```

---

### DotBIM Model Viewer

Load and display a DotBIM model in the browser, including semantic structure via the data graph.

```javascript
import { Scene } from "@xeokit/sdk/scene";
import { Data } from "@xeokit/sdk/data";
import { Viewer } from "@xeokit/sdk/viewer";
import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
import { CameraControl } from "@xeokit/sdk/cameracontrol";
import { DotBIMLoader } from "@xeokit/sdk/formats/dotbim";

// 1) Create containers for geometry and optional structural data
const scene = new Scene();
const data = new Data();

// 2) Create a Viewer and WebGL renderer
const viewer = new Viewer({ scene });
new WebGLRenderer({ viewer });

// 3) Create a View bound to an existing canvas element
const view = viewer.createView({
    id: "myView",
    elementId: "myCanvas" // Ensure this element exists
}).value;

// 4) Position the camera
view.camera.eye = [-6.01, 4.85, 9.11];
view.camera.look = [3.93, -2.65, -12.51];
view.camera.up = [0.12, 0.95, -0.27];

// 5) Enable mouse / touch camera interaction
new CameraControl(view, {});

// 6) Create target models for the loader
const sceneModel = scene.createModel({ id: "myModel" }).value;
const dataModel = data.createModel({ id: "myModel" }).value;

// 7) Create the DotBIM loader
const dotBIMLoader = new DotBIMLoader();

// 8) Fetch and decode the DotBIM file
fetch("model.bim")
    .then((r) => r.arrayBuffer())
    .then((fileData) => {
        // 9) Load geometry (and optional node hierarchy) into the models
        return dotBIMLoader.load({
            fileData,
            sceneModel,
            dataModel
        });
    })
    .then(() => {
        // Model successfully loaded and visible
    })
    .catch((err) => {
        // Clean up on failure
        sceneModel.destroy();
        dataModel.destroy();
        console.error("Error loading DotBIM:", err);
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
