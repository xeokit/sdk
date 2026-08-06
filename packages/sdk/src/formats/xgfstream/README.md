---
title: XGF Stream Format Guide
---
# XGF Stream Loader / Exporter

`XGFStreamExporter` writes a `SceneModel` as an XGF Stream dataset,
`XGFStreamingLoader` loads individual chunks into a `SceneModel`, and
`XGFViewStreamController` schedules chunk loading from the active view.

XGF Stream is the chunked streaming companion to
[`xgf`](../xgf/README.md). It is not a separate geometry encoding: every
chunk is an XGF v2 payload, with a JSON index and per-chunk manifests
describing bounds, dependencies, and file locations.

---

## 1. What XGF Stream is

XGF Stream splits a large renderable model into:

- **Asset-library chunks** — reusable geometry, materials, and textures.
- **References-only chunks** — transforms, meshes, and objects that bind
  to asset-library content by stable ID.
- **An index** — chunk manifests, model bounds, dependency metadata, and
  stream version information.

The format is designed for viewers that do not want to load the whole
model before showing useful context. A scheduler can inspect chunk AABBs,
load only the chunks visible in the current camera frustum, then continue
loading nearby or remaining chunks as the user moves.

The visual model still lands in a normal `SceneModel`. XGF Stream only
changes how that `SceneModel` is populated over time.

### Trade-offs

- Chunk files stay simple: each one is a normal XGF v2 binary payload.
- Asset reuse reduces repeated geometry/material/texture bytes across
  references-only chunks.
- The index is separate JSON, so applications can prioritize and fetch
  without parsing XGF bytes first.
- Streaming is append-style by default: loaded chunks remain resident
  until application code explicitly unloads them.
- Small chunks improve first-view latency, but too many chunks increase
  request, scheduling, and manifest overhead.

---

## 2. Storage shape

A stream package is normally written as a directory:

```text
model/
├── index.json
├── index.runtime.json
└── chunks/
    ├── assets-shared.xgf
    ├── assets-000.xgf
    ├── chunk-00000-x000-y000-z000.xgf
    └── chunk-00001-x000-y000-z001.xgf
```

- **`index.json`** — human-readable stream index, useful for tools and
  debugging.
- **`index.runtime.json`** — compact runtime index with the same chunk
  contract and less JSON parsing/transfer overhead.
- **`chunks/*.xgf`** — XGF v2 chunks with either `assetLibrary` or
  `referencesOnly` role.

The runtime index is optional, but examples and production viewers should
prefer it when present.

---

## 3. Index and manifests

An `XGFStreamingIndex` carries the stream version, aggregate metadata, and
an array of `XGFChunkManifest` records. Each manifest describes one XGF
chunk:

- **`id`** — stable chunk identifier.
- **`uri`** — stream-relative chunk URI.
- **`role`** — `assetLibrary` or `referencesOnly`.
- **`worldAABB` / `aabb`** — chunk bounds for scheduling and frustum
  tests.
- **`dependencies.chunks`** — asset-library chunks that must be loaded
  first.
- **asset/object summaries** — metadata used by tools and loaders to
  track ownership.

Indexes may also include an optional **`coordinateSystem`** object with
`basis`, `origin`, `units`, and `scaleToMeters`. This records the spatial
reference frame used by the stream package and is preserved in compact
runtime indexes. Recursive root indexes can inspect this metadata when
placing child streams, while `streams[].origin` remains the explicit
translation used by the current recursive loader.

Runtime indexes are decoded with `readXGFStreamingRuntimeIndex`. The
function returns an `SDKResult`, so validation failures are reported
without throwing.

```ts
import {readXGFStreamingRuntimeIndex} from "@xeokit/sdk/formats/xgfstream";

const runtimeJSON = await (await fetch("./model/index.runtime.json")).json();
const indexResult = readXGFStreamingRuntimeIndex(runtimeJSON);

if (!indexResult.ok) {
  scene.logError(indexResult);
  return;
}

const index = indexResult.value;
```

When loading a stream from a relative URL, resolve manifest `uri` fields
against the index URL before handing the index to a controller or manual
loader, or provide a `baseUri` through loader options.

---

## 4. Export pipeline

`XGFStreamExporter` is the high-level exporter. It partitions a
`SceneModel`, creates asset libraries, writes references-only chunks, and
returns a file map.

```
   SceneModel
        │
        ▼
   XGFStreamExporter.write
        │
        ├─ partition objects
        ├─ extract asset libraries
        ├─ encode XGF v2 assetLibrary chunks
        ├─ encode XGF v2 referencesOnly chunks
        ├─ write index.json
        └─ optionally write index.runtime.json
        ▼
   XGFStreamFileMap
```

Grid partitioning is the default because view-prioritized streaming needs
chunk bounds with useful spatial locality. Use `partition:
"object-order"` only when deterministic source-order chunking matters
more than camera locality.

```ts
import {XGFStreamExporter} from "@xeokit/sdk/formats/xgfstream";

const result = await new XGFStreamExporter().write(
  {sceneModel},
  {
    partition: "grid",
    chunkMetric: "objects",
    chunkSize: 500,
    assetLibraryChunkSize: 16,
    sharedAssetMinLibraryUses: 2,
    sharedAssetMode: "global",
    sharedAssetShardSize: 512,
    runtimeIndex: "index.runtime.json"
  }
);

const {files, index, manifests} = result;
```

`files` is keyed by stream-relative URI. Values are `ArrayBuffer` chunk
bytes or JSON objects for the generated indexes/manifests; persist them
with the same relative paths written in the manifests.

When `assetLibraryChunkSize` is used, `sharedAssetMode: "global"` keeps
reused geometry/material/texture assets in one shared dependency.
`sharedAssetMode: "local"` duplicates reused assets into each local
asset library instead. Local mode can reduce first-frustum fetch size for
fine-grained streams, at the cost of a larger complete stream package.
`sharedAssetMode: "sharded"` splits reused assets into multiple shared
asset-library chunks, ordered by asset-library co-usage before packing.
Reference chunks list only the shards they need, so already-loaded shared
shards can be skipped before fetch.

### Node generator scripts

The website stream generators are useful reference scripts for content
pipelines that run outside the browser:

- [`generate-xgf-streaming-baku-example.js`](../../../../website/scripts/generate-xgf-streaming-baku-example.js)
  converts a large source GLB through `xeoconvert` into grid-partitioned
  stream data.
- [`generate-xgf-streaming-lyon-example.js`](../../../../website/scripts/generate-xgf-streaming-lyon-example.js)
  loads several XKT files into one `SceneModel`, applies a model
  coordinate system, and exports one merged stream.
- [`generate-xgf-streaming-archipelago-example.js`](../../../../website/scripts/generate-xgf-streaming-archipelago-example.js)
  builds procedural scene content, places existing XGF models, and
  exports the combined result.
- [`generate-xgf-streaming-example.js`](../../../../website/scripts/generate-xgf-streaming-example.js)
  shows explicit asset-library and references-only chunk manifests for a
  small hand-authored stream.
- [`generate-xgf-streaming-recursive-example.js`](../../../../website/scripts/generate-xgf-streaming-recursive-example.js)
  writes a root index that references other stream indexes instead of
  copying their chunks.

See [`packages/website/scripts/README.md`](../../../../website/scripts/README.md)
for the current script list and the common generation pipeline.

---

## 5. Manual chunk loading

Use `XGFStreamingLoader` when application code decides exactly which
chunks to load. It resolves dependency manifests, fetches missing chunk
bytes through `getFileData`, and applies chunks to the target
`SceneModel`.

```ts
import {
  createXGFStreamingIndexLookup,
  XGFStreamingLoader
} from "@xeokit/sdk/formats/xgfstream";

const lookup = createXGFStreamingIndexLookup(index);
const loader = new XGFStreamingLoader();
const chunk = lookup.getChunkById("chunk-00042");

if (chunk) {
  await loader.loadChunk(
    {
      manifest: chunk,
      sceneModel,
      dataModel
    },
    {
      manifests: lookup,
      getFileData: async (manifest) =>
        (await fetch(`./model/${manifest.uri}`)).arrayBuffer(),
      onChunkLoaded: (manifest) => {
        console.log(`loaded ${manifest.id}`);
      }
    }
  );
}
```

The loader also supports `loadChunks` for dependency-safe batch loading,
bounded fetch concurrency, and `unloadChunk` for removing previously
loaded content. Asset-library chunks cannot be unloaded while loaded
references-only chunks still use their assets.

Handled validation and dependency failures are reported on the owning
`Scene` error channel instead of throwing.

---

## 6. View-prioritized streaming

Use `XGFViewStreamController` when chunk loading should follow a `View`.
It filters references-only chunks by the current camera frustum, loads
visible chunks first, and orders candidates by distance to the camera look
point. Set `minProjectedChunkSizePixels` to skip chunks that are visible but
too small on the canvas, and set `chunkPriorityTarget: "eye"` to prioritize
from the camera position instead.
Already-loaded chunks stay resident.

```ts
import {XGFViewStreamController} from "@xeokit/sdk/formats/xgfstream";

const controller = new XGFViewStreamController({
  index,
  sceneModel,
  view,
  frustumOnly: true,
  minProjectedChunkSizePixels: 4,
  batchSize: 8,
  fetchConcurrency: 8,
  commitFrameBudgetMs: 0,
  loadOptions: {
    getFileData: async (manifest) =>
      (await fetch(`./model/${manifest.uri}`)).arrayBuffer()
  },
  onProgress: ({queued, loaded}) => {
    progress.value = queued > 0 ? loaded / queued : 1;
  },
  onError: (error) => {
    console.error(error);
  }
});

controller.prefetchInitial(16);
controller.schedule("initial frustum");
```

Call `schedule()` whenever the relevant camera/frustum changes. The
controller debounces scheduling, prefetches high-priority files, and
commits chunks through `XGFStreamingLoader`.

Useful controller state:

- **`loadedChunkIds`** — references-only chunks already loaded.
- **`loadedAssetLibraryIds`** — asset-library chunks already loaded.
- **`loadedTotals`** — aggregate objects/meshes loaded through the
  controller.
- **`queueProgress`** — current scheduled generation, queued chunk count,
  and loaded chunk count.

---

## 7. Relationship to XGF

XGF Stream depends on XGF v2 roles:

- **`assetLibrary`** chunks create shared assets in the target
  `SceneModel`.
- **`referencesOnly`** chunks create transforms, meshes, and objects that
  refer to those shared assets.

The low-level [`XGFLoader`](../xgf/README.md) can apply a supplied XGF v2
payload, but it does not fetch dependencies, read stream indexes, or
schedule chunk loading. XGF Stream adds that manifest-aware orchestration
above XGF.

---

## 8. File map

```
formats/xgfstream/
├── README.md                         (this file)
├── index.ts                          module re-exports
├── XGFStreamExporter.ts              high-level stream file-map exporter
├── XGFStreamingLoader.ts             manifest-aware chunk loader/unloader
├── chunk/
│   ├── XGFChunkManifest.ts           per-chunk metadata
│   ├── XGFChunkLoadOptions.ts        single-chunk load options
│   ├── XGFChunksLoadOptions.ts       batch load options
│   └── XGFChunkLoadStats.ts          timing/ownership stats
├── index/
│   ├── XGFStreamingIndex.ts          human-readable stream index
│   ├── XGFStreamingRuntimeIndex.ts   compact runtime index
│   ├── readXGFStreamingIndex.ts
│   ├── writeXGFStreamingIndex.ts
│   ├── readXGFStreamingRuntimeIndex.ts
│   ├── writeXGFStreamingRuntimeIndex.ts
│   └── createXGFStreamingIndexLookup.ts
├── manifest/
│   ├── readXGFChunkManifest.ts
│   ├── writeXGFChunkManifest.ts
│   └── validateXGFChunkManifest.ts
└── view/
    ├── XGFViewStreamController.ts
    └── XGFViewStreamControllerParams.ts
```
