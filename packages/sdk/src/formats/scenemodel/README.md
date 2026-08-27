---
title: SceneModelParams Format Guide
---
# SceneModelParams (xeokit JSON) Loader / Exporter

`SceneModelImporter` reads a `SceneModelParams` JSON document into a
`SceneModel`, and `SceneModelExporter` writes a `SceneModel` back
out as `SceneModelParams`.

`SceneModelParams` is the SDK's **canonical JSON representation** of a
SceneModel — the same param object accepted by `Scene.createModel` and
produced by `SceneModel.toParams`. This module is the thin
loader/exporter wrapper that plugs that representation into the common
`ModelLoader` / `ModelExporter` pipeline, so it lives alongside the
binary format adapters (FBX, RVM, XGF, …) and is driven the same way.

---

## 1. The format

`SceneModelParams` is a plain JSON object — no binary container, no
quantisation pass of its own. It captures a SceneModel's complete
renderable state:

- **`id`**, **`coordinateSystem`** (origin / scale / basis), and the
  model placement (`matrix` / `position` / `scale` / `quaternion`).
- **Geometries** — both uncompressed (`SceneGeometryParams`) and
  already-compressed (`SceneGeometryCompressedParams`) buffers.
- **Meshes**, **objects**, **transforms**, **materials**, and
  **textures**.

Because it mirrors the SceneModel's own param surface, a round-trip is
**lossless**: object ids, geometry ids, transforms, and coordinate-system
settings survive export → import unchanged, with no re-tessellation or
re-quantisation. That makes it useful as a cache payload, a test fixture,
or a hand-inspectable debug dump.

The document carries an optional **`version`** field. It is absent in
hand-written documents and defaults to `"1.0"`; the loader keys its
parser table on it.

---

## 2. Load / export pipeline

Both sides are deliberately thin — the real work lives on `SceneModel`:

```
   SceneModelParams (JSON object)
        │
        ▼
   versions/1_0/parse.ts
        │   sceneModel.fromParams(fileData)
        ▼
   SceneModel populated


   SceneModel
        │
        ▼
   versions/1_0/encode.ts
        │   sceneModel.toParams()  →  SceneModelParams
        ▼
   SceneModelParams (JSON object)
```

- **Loader** (`SceneModelImporter`) — `format: "SceneModelParams"`,
  `fileDataType: "json"`. `getVersion` reads `fileData.version` (falling
  back to `"1.0"`) and dispatches to the matching parser. The `"1.0"`
  parser delegates straight to `SceneModel.fromParams`.
- **Exporter** (`SceneModelExporter`) — same `format`, same
  `fileDataType`, `defaultVersion: "1.0"`. The `"1.0"` encoder calls
  `SceneModel.toParams` and resolves the resulting `SceneModelParams`
  object. Encoding yields cooperatively to the host (`yieldToHost`) so a
  large model doesn't block the main thread.

`fileData` here is the **parsed JSON object**, not a string — read the
`.json` with `JSON.parse` (or `response.json()`) before handing it to the
loader, and `JSON.stringify` the exporter's result before persisting it.

---

## 3. Usage

### Loader

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {SceneModelImporter} from "@xeokit/sdk/formats/scenemodel";

const scene = new Scene();
const sceneModel = scene.createModel({id: "myModel"}).value;

const fileData = await (await fetch("model.json")).json();

await new SceneModelImporter().load({fileData, sceneModel});
```

### Exporter

```ts
import {SceneModelExporter} from "@xeokit/sdk/formats/scenemodel";

const sceneModelParams = await new SceneModelExporter().write({sceneModel});
const json = JSON.stringify(sceneModelParams);
// persist or transmit `json`
```

The exporter resolves the `SceneModelParams` object itself; stringify it
yourself when you need bytes on disk or over the wire.

---

## 4. File map

```
formats/scenemodel/
├── README.md                     (this file)
├── SceneModelImporter.ts     ModelLoader subclass — entry point
├── SceneModelExporter.ts     ModelExporter subclass — write-side
├── index.ts                  module re-exports
└── versions/1_0/
    ├── parse.ts                  fileData → SceneModel.fromParams
    └── encode.ts                 SceneModel.toParams → SceneModelParams
```
