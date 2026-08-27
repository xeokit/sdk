---
title: SceneModel updateHint - Runtime Value Uploads
---

# SceneModel updateHint - Runtime Value Uploads

`SceneModel.updateHint` tells the renderer how often a model's renderer-facing values are expected to be uploaded after creation.

It is a model-level runtime hint. The same application can load one `SceneModel` as static and another as dynamic, and the renderer can choose the storage path per model batch.

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
| `"auto"` | Let the renderer choose its safe default. In the current WebGL renderer this follows the dynamic/data-texture path. |

Treat `updateHint` as a load-time decision. Set it before loaders create meshes so the renderer can put newly registered objects into the intended storage path.

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

## Choosing A Hint

| Workload | Recommended hint | Reason |
|---|---|---|
| Single optimized XGF model that is loaded once and then inspected | `"static"` | Stable renderer-facing values can use the VBO-backed path. |
| XGF stream optimized for fastest initial visibility | `"dynamic"` | Keeps incoming state on the update-friendly path while chunks arrive. |
| XGF stream used to benchmark settled static rendering | `"static"` | Exercises VBO-backed batches and draw-time behavior under streaming pressure. |
| Frequently recolored, transformed or state-updated model | `"dynamic"` | Keeps value uploads on the update-friendly path. |
| Unknown workload | `"auto"` or `"dynamic"` | Current WebGL default is the data-texture path. |

Chunk count and asset partitioning can change the result. A 200-chunk stream, a 2K-chunk stream, and a 4K-chunk stream do not stress the same bottleneck. First-frustum dependencies also matter: a small visible chunk that depends on a large shared asset file still waits for that shared asset, regardless of DTX or VBO storage.

## XGF Examples

Single-file XGF examples with explicit hints:

| Example | Hint | Notes |
|---|---|---|
| [XGF West Riverside Hospital Static](https://xeokit.github.io/sdk/examples/index.html#import/xgf/west-river-side-hospital) | `static` | Loads a hospital XGF into a static `SceneModel`. |
| [XGF Sports Car - Multiple Views](https://xeokit.github.io/sdk/examples/index.html#import/xgf/sports-car) | `dynamic` | Loads XGF into a dynamic `SceneModel` for a multi-view setup. |

Streaming XGF configuration examples:

| Example | Hint | What it is used to compare |
|---|---|---|
| [Streamed XGF Stadium, 2K Chunks, Dynamic](https://xeokit.github.io/sdk/examples/index.html#benchmarks/streaming/xgf-baku-2000-dynamic) | `dynamic` | Fast-load baseline for streaming budgets, cache limits, camera stalling, and model partitioning. |
| [Streamed XGF Stadium, 200 Chunks, Static](https://xeokit.github.io/sdk/examples/index.html#streaming/xgf/baku-200-static) | `static` | Coarse model partitioning versus VBO upload cost. |
| [Streamed XGF Stadium, 4K Chunks, Dynamic](https://xeokit.github.io/sdk/examples/index.html#benchmarks/streaming/xgf-baku-4000-dynamic) | `dynamic` | High-chunk-count data-texture baseline for first-frustum loading and request fan-out. |
| [Streamed XGF Stadium, 4K Chunks, Static](https://xeokit.github.io/sdk/examples/index.html#benchmarks/streaming/xgf-baku-4000-static) | `static` | Static VBO uploads under many small streamed chunks. |
| [XGF Stream West Riverside Hospital Static](https://xeokit.github.io/sdk/examples/index.html#streaming/xgf/west-river-side-hospital-static) | `static` | Hospital stream with review viewpoints and camera-move stream stalling. |
| [XGF Recursive Streaming - Nested Model Set](https://xeokit.github.io/sdk/examples/index.html#streaming/xgf/recursive) | `static` | Recursive child streams with independent view-prioritized loading. |
| [XGF Streamed LoD2 Lyon](https://xeokit.github.io/sdk/examples/index.html#streaming/xgf/lyon) | `static` | City-scale streamed chunk set. |
| [XGF Streamed Archipelago](https://xeokit.github.io/sdk/examples/index.html#streaming/xgf/archipelago) | `dynamic` | Geolocated merged stream with mixed terrain, building, and ship content. |
| [XGF Streaming OTC Conference Center](https://xeokit.github.io/sdk/examples/index.html#streaming/xgf/otc) | `dynamic` | Viewpoint-driven review loading where visible chunks are prioritized. |
| [XGF Stream House Plan](https://xeokit.github.io/sdk/examples/index.html#streaming/xgf/house-plan) | `dynamic` | Small building stream using the update-friendly path. |

These examples are intentionally varied. They are used to find practical sweet spots across model partitioning, first-frustum dependency layout, request fan-out, VBO upload cadence, data-texture update cost, and settled navigation performance. There is no universal fastest setting independent of the model and loading pattern.
