---
title: SceneModel updateHint - Runtime Value Uploads
---

# SceneModel updateHint - Runtime Value Uploads

`SceneModel.updateHint` tells renderers how often a model's renderer-facing values are expected to be uploaded after creation.

It is a model-level runtime hint. The same application can load one `SceneModel` as static and another as dynamic, and each renderer can decide whether that hint maps to a distinct storage path.

In the current SDK, this hint has a concrete storage effect in `WebGLRenderer`. `WebGPURenderer` accepts the same model contract, but its current storage decisions are driven by `SceneModel.lifecycle`, `SceneModel.memoryPolicy`, primitive type, material texture grouping, and WebGPU memory configuration rather than by `updateHint`.

## API Contract

`updateHint` is accepted when a `SceneModel` is created, loaded from params, or loaded through Studio helpers.

```ts
const sceneModel = scene.createModel({
  id: "hospital",
  coordinateSystem,
  updateHint: "static"
}).value!;
```

```ts
await studio.loadDataset({
  modelId: "BakuStadium_2000",
  formats: ["xgfstream"],
  updateHint: "dynamic"
});
```

Supported values:

| Value | Meaning |
|---|---|
| `"static"` | Runtime uploads of matrices, transforms, colors and object state are expected to be infrequent. Renderers may prefer draw-time optimized storage. |
| `"dynamic"` | Runtime uploads of matrices, transforms, colors or object state are expected to be frequent. Renderers may prefer update-friendly storage. |
| `"auto"` | Let the renderer choose its safe default. In the current WebGL renderer this follows the dynamic/data-texture path. In the current WebGPU renderer this does not select a separate storage mode. |

Treat `updateHint` as a load-time decision. Set it before loaders create meshes so the renderer can put newly registered objects into the intended storage path.

For WebGPU streaming and compact allocation, also set `lifecycle` and `memoryPolicy` explicitly when those policies matter. Those fields are independent from `updateHint`.

## WebGL Renderer Storage

The WebGL renderer currently applies `updateHint` to triangle batch storage:

| SceneModel hint | Triangle batch storage | Notes |
|---|---|---|
| `"static"` | VBO-backed batches | Optimizes stable renderer-facing values for drawing. |
| `"dynamic"` | Data-texture-backed batches | Favors frequent value uploads and update-friendly registration. |
| `"auto"` or unset | Data-texture-backed batches | Current safe default. |
| Non-triangle primitives | Data-texture-backed batches | Points and lines use the renderer's update-friendly path. |

This selection is driven by the `SceneModel` hint. Renderer memory configuration can still tune capacities, but it should not be used to choose DTX versus VBO for a model.

## Data Textures

The data-texture path stores renderer-facing values in GPU textures addressed from shaders.

This is the update-friendly path:

- visibility, selection, x-ray, opacity, color, and transform changes stay as texture updates
- `auto` and `dynamic` models use this path in the current WebGL renderer

Use `dynamic` when frequent matrix, transform, color or object-state uploads matter more than settled draw-time layout.

## VBO Geometry

The VBO path is used for `"static"` triangle batches.

It is not a full return to one draw call per mesh. It is a hybrid path:

- triangle positions and lookup attributes live in batch-owned VBOs
- mesh, material, view, RTC tile, and other renderer state still come from GPU data textures
- batches are still renderer-owned and still draw many meshes together

This moves storage setup toward load time. For models whose renderer-facing values stay stable across many frames, that can be worthwhile. For streams with many tiny chunks, upload and packing cadence can dominate early loading unless stream partitioning and first-frustum dependencies are tuned.

The default VBO triangle batch capacity is:

```ts
memoryConfigs.vboGeometry.maxBatchPrims = 200000;
```

That capacity is a tuning knob for static triangle VBO batches. `SceneModel.updateHint` selects the model's renderer storage preference.

## WebGPU Renderer Storage

The WebGPU renderer does not currently choose a separate static or dynamic path from `SceneModel.updateHint`.

Instead, WebGPU packs renderable geometry into persistent GPU buffer pages managed by `TriangleBatchManager` and uploads per-draw instance data through storage buffers managed by `InstanceBufferManager`.

| SceneModel field | Current WebGPU effect |
|---|---|
| `updateHint` | Accepted as part of the shared `SceneModel` API, but not currently used to choose WebGPU buffer layout or page sizing. |
| `lifecycle` | Groups packed triangle segments as open, streaming or sealed content. With the default stream memory policy, open/streaming/sealed models are normalized to streaming-style segment groups unless sealed-stream compaction is enabled. |
| `memoryPolicy` | Controls whether WebGPU should keep append headroom (`"stream"`) or allocate more tightly around finalized content (`"compact"`). |
| `memoryConfigs.compactStreamPages` | Uses tightly fitted packed pages for live streaming models, lowering peak GPU memory at the cost of more pages and draw calls. |
| `memoryConfigs.compactSealedStreamPages` | Allows sealed streaming models to be rebuilt without append headroom after loading completes. |

Runtime value changes in WebGPU are handled through instance-buffer updates:

- mesh transform, color, opacity and view-dependent draw state are written into per-view instance data
- changed instance slots are tracked as dirty ranges
- `GPUQueue.writeBuffer` uploads only the dirty slot ranges when possible
- structural appends can add new mesh slots without forcing a full instance-buffer upload

This means `dynamic` is still a useful application-level declaration of intent, but it is not the switch that makes WebGPU value uploads incremental. Incremental uploads are part of the current WebGPU renderer's normal instance-buffer path.

For WebGPU streams, choose `lifecycle: "streaming"` while chunks are still arriving. Seal the model only after all chunks have loaded, no chunk loads are pending, and renderer-side pending segment work has drained. Use `memoryPolicy: "compact"` or the WebGPU compact-page memory flags when memory footprint matters more than keeping append headroom.

## Choosing A Hint

| Workload | Recommended hint | Reason |
|---|---|---|
| Single optimized XGF model that is loaded once and then inspected | `"static"` | In WebGL, stable renderer-facing values can use the VBO-backed path. In WebGPU, pair this with sealed or compact allocation policy if you also want tight packed pages. |
| XGF stream optimized for fastest initial visibility | `"dynamic"` | In WebGL, keeps incoming state on the update-friendly path while chunks arrive. In WebGPU, also use `lifecycle: "streaming"` and leave append headroom unless memory pressure requires compact pages. |
| XGF stream used to benchmark settled static rendering | `"static"` | Exercises the WebGL VBO-backed path. For WebGPU, the comparable settled benchmark is controlled by lifecycle, sealing, compact-page settings and render configuration. |
| Frequently recolored, transformed or state-updated model | `"dynamic"` | Communicates frequent runtime value changes. WebGL uses the data-texture path; WebGPU uses normal dirty-range instance-buffer uploads. |
| Unknown workload | `"auto"` or `"dynamic"` | Current WebGL default is the data-texture path. Current WebGPU storage does not change for `auto` versus `dynamic`. |

Chunk count and asset partitioning can change the result. A 200-chunk stream, a 2K-chunk stream, and a 4K-chunk stream do not stress the same bottleneck. First-frustum dependencies also matter: a small visible chunk that depends on a large shared asset file still waits for that shared asset, regardless of DTX or VBO storage.

## XGF Examples

Single-file XGF examples with explicit hints:

| Example | Hint | Notes |
|---|---|---|
| [XGF West Riverside Hospital Static](https://xeokit.github.io/sdk/examples/index.html#sdk/import/xgf/west-river-side-hospital) | `static` | Loads a hospital XGF into a static `SceneModel`. |
| [XGF Sports Car - Multiple Views](https://xeokit.github.io/sdk/examples/index.html#sdk/import/xgf/sports-car) | `dynamic` | Loads XGF into a dynamic `SceneModel` for a multi-view setup. |

Streaming XGF configuration examples:

| Example | Hint | What it is used to compare |
|---|---|---|
| [Streamed XGF Stadium, 2K Chunks, Dynamic](https://xeokit.github.io/sdk/examples/index.html#studio/benchmarks/streaming/xgf-baku-2000-dynamic) | `dynamic` | Fast-load baseline for streaming budgets, cache limits, camera stalling, and model partitioning. |
| [Streamed XGF Stadium, 200 Chunks, Static](https://xeokit.github.io/sdk/examples/index.html#studio/streaming/xgf/baku-200-static) | `static` | Coarse model partitioning versus VBO upload cost. |
| [Streamed XGF Stadium, 4K Chunks, Dynamic](https://xeokit.github.io/sdk/examples/index.html#studio/benchmarks/streaming/xgf-baku-4000-dynamic) | `dynamic` | High-chunk-count data-texture baseline for first-frustum loading and request fan-out. |
| [Streamed XGF Stadium, 4K Chunks, Static](https://xeokit.github.io/sdk/examples/index.html#studio/benchmarks/streaming/xgf-baku-4000-static) | `static` | Static VBO uploads under many small streamed chunks. |
| [XGF Stream West Riverside Hospital Static](https://xeokit.github.io/sdk/examples/index.html#studio/streaming/xgf/west-river-side-hospital-static) | `static` | Hospital stream with review viewpoints and camera-move stream stalling. |
| [XGF Recursive Streaming - Nested Model Set](https://xeokit.github.io/sdk/examples/index.html#studio/streaming/xgf/recursive) | `static` | Recursive child streams with independent view-prioritized loading. |
| [XGF Streamed LoD2 Lyon](https://xeokit.github.io/sdk/examples/index.html#studio/streaming/xgf/lyon) | `static` | City-scale streamed chunk set. |
| [XGF Streamed Archipelago](https://xeokit.github.io/sdk/examples/index.html#studio/streaming/xgf/archipelago) | `dynamic` | Geolocated merged stream with mixed terrain, building, and ship content. |
| [XGF Streaming OTC Conference Center](https://xeokit.github.io/sdk/examples/index.html#studio/streaming/xgf/otc) | `dynamic` | Viewpoint-driven review loading where visible chunks are prioritized. |
| [XGF Stream House Plan](https://xeokit.github.io/sdk/examples/index.html#studio/streaming/xgf/house-plan) | `dynamic` | Small building stream using the update-friendly path. |

These examples are intentionally varied. They are used to find practical sweet spots across model partitioning, first-frustum dependency layout, request fan-out, VBO upload cadence, data-texture update cost, and settled navigation performance. There is no universal fastest setting independent of the model and loading pattern.
