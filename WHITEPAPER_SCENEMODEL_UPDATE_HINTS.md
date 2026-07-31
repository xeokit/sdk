---
title: SceneModel updateHint - Static and Dynamic Rendering
---

# SceneModel updateHint - Static and Dynamic Rendering

`SceneModel.updateHint` tells the renderer how a model's geometry is expected to behave after creation.

It is a model-level runtime hint, not an XGF format flag and not a renderer-wide switch. The same application can load one `SceneModel` as static and another as dynamic, and the renderer can choose the storage path per model batch.

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
| `"static"` | The model's geometry is expected to be stable after loading. Renderers may prefer draw-time optimized storage. |
| `"dynamic"` | The model is expected to be progressively loaded, frequently modified, or otherwise update-heavy. Renderers may prefer update-friendly storage. |
| `"auto"` | Let the renderer choose its safe default. In the current WebGL renderer this follows the dynamic/data-texture path. |

`updateUsage` remains as a deprecated alias for `updateHint`.

`"stream"` is accepted only as a legacy compatibility value and is normalized to `"dynamic"`. New code should use `"dynamic"` directly.

Treat `updateHint` as a load-time decision. Set it before loaders create meshes so the renderer can batch newly registered geometry into the intended storage path.

## WebGL Renderer Storage

The WebGL renderer currently applies `updateHint` to triangle geometry storage:

| SceneModel hint | Triangle geometry storage | Notes |
|---|---|---|
| `"static"` | VBO geometry batches | Optimizes stable triangle geometry for drawing. |
| `"dynamic"` | Data-texture geometry batches | Favors progressive loading and update-friendly registration. |
| `"auto"` or unset | Data-texture geometry batches | Current safe default. |
| Non-triangle primitives | Data-texture geometry batches | Points and lines do not use the triangle VBO path. |

This selection is driven by the `SceneModel` hint. Renderer memory configuration can still tune capacities, but it should not be used to choose DTX versus VBO for a model.

## Data Textures

The data-texture path stores geometry, transforms, material state, object flags, and view-dependent state in GPU textures addressed from shaders.

This is the update-friendly path:

- progressive XGF streams can register many small chunks without VBO packing cost
- visibility, selection, x-ray, opacity, color, and transform changes stay as texture updates
- `auto` and `dynamic` models use this path in the current WebGL renderer

Use `dynamic` when first-frustum loading speed, frequent changes, or streaming cadence matters more than settled draw-time geometry layout.

## VBO Geometry

The VBO path is used for `"static"` triangle geometry.

It is not a full return to one draw call per mesh. It is a hybrid path:

- triangle positions and lookup attributes live in batch-owned VBOs
- mesh, material, view, RTC tile, and other renderer state still come from GPU data textures
- batches are still renderer-owned and still draw many meshes together

This moves work toward load time: geometry must be packed into VBO batches and uploaded. For stable models that are drawn many times, that can be worthwhile. For streamed models with many tiny chunks, the upload and packing cadence can dominate early loading unless the stream partitioning and first-frustum dependencies are tuned.

The default VBO triangle batch capacity is:

```ts
memoryConfigs.vboGeometry.maxBatchPrims = 200000;
```

That capacity is a tuning knob for static triangle VBO batches. It does not decide whether a model uses VBOs; `SceneModel.updateHint` does.

## Choosing A Hint

| Workload | Recommended hint | Reason |
|---|---|---|
| Single optimized XGF model that is loaded once and then inspected | `"static"` | Stable triangle geometry can use the VBO path. |
| XGF stream optimized for fastest initial visibility | `"dynamic"` | Avoids VBO upload/packing cost while chunks arrive. |
| XGF stream used to benchmark settled static rendering | `"static"` | Exercises VBO uploads and draw-time behavior under streaming pressure. |
| Frequently rebuilt or edited model | `"dynamic"` | Keeps geometry registration and state changes on the update-friendly path. |
| Unknown workload | `"auto"` or `"dynamic"` | Current WebGL default is the data-texture path. |

Chunk count and asset partitioning can change the result. A 200-chunk stream, a 2K-chunk stream, and a 4K-chunk stream do not stress the same bottleneck. First-frustum dependencies also matter: a small visible chunk that depends on a large shared asset file still waits for that shared asset, regardless of DTX or VBO storage.

## XGF Examples

Single-file XGF examples with explicit hints:

| Example | Hint | Notes |
|---|---|---|
| [XGF West Riverside Hospital Static](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_westRiverSideHospital) | `static` | Loads a hospital XGF into a static `SceneModel`. |
| [XGF Sports Car - Multiple Views](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_sportsCar) | `dynamic` | Loads XGF into a dynamic `SceneModel` for a multi-view setup. |

Streaming XGF configuration examples:

| Example | Hint | What it is used to compare |
|---|---|---|
| [Streamed XGF Stadium, 2K Chunks, Dynamic](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_baku_2000_dynamic) | `dynamic` | Fast-load baseline for streaming budgets, cache limits, camera stalling, and model partitioning. |
| [Streamed XGF Stadium, 200 Chunks, Static](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_baku_200_static) | `static` | Coarse model partitioning versus VBO upload cost. |
| [Streamed XGF Stadium, 4K Chunks, Dynamic](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_baku_4000_dynamic) | `dynamic` | High-chunk-count data-texture baseline for first-frustum loading and request fan-out. |
| [Streamed XGF Stadium, 4K Chunks, Static](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_baku_4000_static) | `static` | Static VBO uploads under many small streamed chunks. |
| [XGF Stream West Riverside Hospital Static](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_westRiverSideHospital_static) | `static` | Hospital stream with review viewpoints and camera-move stream stalling. |
| [XGF Recursive Streaming - Nested Model Set](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_recursive) | `static` | Recursive child streams with independent view-prioritized loading. |
| [XGF Streamed LoD2 Lyon](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_lyon) | `static` | City-scale streamed chunk set. |
| [XGF Streamed Archipelago](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_archipelago) | `dynamic` | Geolocated merged stream with mixed terrain, building, and ship content. |
| [XGF Streaming OTC Conference Center](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_otc) | `dynamic` | Viewpoint-driven review loading where visible chunks are prioritized. |
| [XGF Stream House Plan](https://xeokit.github.io/sdk/examples/index.html#formats_xgf_streaming_housePlan) | `dynamic` | Small building stream using the update-friendly path. |

These examples are intentionally varied. They are used to find practical sweet spots across model partitioning, first-frustum dependency layout, request fan-out, VBO upload cadence, data-texture update cost, and settled navigation performance. There is no universal fastest setting independent of the model and loading pattern.
