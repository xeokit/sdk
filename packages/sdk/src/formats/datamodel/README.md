---
title: DataModelParams Format Guide
---
# DataModelParams (xeokit JSON) Loader / Exporter

`DataModelImporter` reads a `DataModelParams` JSON document into a
`DataModel`, and `DataModelExporter` writes a `DataModel` back out as
`DataModelParams`.

`DataModelParams` is the SDK's **canonical JSON representation** of a
DataModel — the same param object accepted by `Data.createModel` and
produced by `DataModel.toParams`. This module is the thin
loader/exporter wrapper that plugs that representation into the common
`ModelLoader` / `ModelExporter` pipeline, so it lives alongside the
binary format adapters (FBX, RVM, XGF, …) and is driven the same way.

It is the **semantic** counterpart to the `scenemodel` format: where
`SceneModelParams` carries the renderable half of a model (geometry,
meshes, textures), `DataModelParams` carries the semantic half (objects,
relationships, properties). The two pair naturally — a `.json` data
sidecar alongside an `.xgf` geometry payload.

---

## 1. The format

`DataModelParams` is a plain JSON object — no binary container, no
geometry. It captures a DataModel's complete semantic state:

- **`id`** plus optional metadata — `projectId`, `revisionId`,
  `author`, `createdAt`, `creatingApplication`, `schema`.
- **`propertySets`** — named property sets, each a list of typed
  properties.
- **`objects`** — the `DataObject` graph (typed semantic entities).
- **`relationships`** — typed links between objects.

Because it mirrors the DataModel's own param surface, a round-trip is
**lossless**: object ids, relationships, and properties survive export →
import unchanged. That makes it useful as a cache payload, a test
fixture, or a hand-inspectable debug dump.

The document carries an optional **`version`** field — the exporter
stamps `"1.0"`, and the loader keys its parser table on it, defaulting
to `"1.0"` when absent.

---

## 2. Load / export pipeline

Both sides are deliberately thin — the real work lives on `DataModel`:

```
   DataModelParams (JSON object)
        │
        ▼
   versions/1_0/parse.ts
        │   dataModel.fromParams(fileData)
        ▼
   DataModel populated


   DataModel
        │
        ▼
   versions/1_0/encode.ts
        │   dataModel.toParams()  →  DataModelParams  (+ version "1.0")
        ▼
   DataModelParams (JSON object)
```

- **Loader** (`DataModelImporter`) — `format: "DataModelParams"`,
  `fileDataType: "json"`. `getVersion` reads `fileData.version` (falling
  back to `"1.0"`) and dispatches to the matching parser. The `"1.0"`
  parser delegates straight to `DataModel.fromParams`.
- **Exporter** (`DataModelExporter`) — same `format`, same
  `fileDataType`, `defaultVersion: "1.0"`. The `"1.0"` encoder calls
  `DataModel.toParams`, stamps `version: "1.0"`, and resolves the
  resulting `DataModelParams` object. Encoding yields cooperatively to
  the host (`yieldToHost`) so a large model doesn't block the main
  thread.

`fileData` here is the **parsed JSON object**, not a string — read the
`.json` with `JSON.parse` (or `response.json()`) before handing it to the
loader, and `JSON.stringify` the exporter's result before persisting it.

Unlike a `SceneModel`, a `DataModel` has **no `build()` step** — it is
ready to query as soon as `load` resolves.

---

## 3. Usage

### Loader

```ts
import {Data} from "@xeokit/sdk/model/data";
import {DataModelImporter} from "@xeokit/sdk/datamodel";

const data = new Data();
const dataModel = data.createModel({id: "myModel"}).value;

const fileData = await (await fetch("model.json")).json();

await new DataModelImporter().load({fileData, dataModel});
```

### Exporter

```ts
import {DataModelExporter} from "@xeokit/sdk/datamodel";

const dataModelParams = await new DataModelExporter().write({dataModel});
const json = JSON.stringify(dataModelParams);
// persist or transmit `json`
```

The exporter resolves the `DataModelParams` object itself; stringify it
yourself when you need bytes on disk or over the wire.

---

## 4. File map

```
formats/datamodel/
├── README.md                 (this file)
├── DataModelImporter.ts      ModelLoader subclass — entry point
├── DataModelExporter.ts      ModelExporter subclass — write-side
├── index.ts                  module re-exports
└── versions/1_0/
    ├── parse.ts              fileData → DataModel.fromParams
    └── encode.ts             DataModel.toParams → DataModelParams
```
