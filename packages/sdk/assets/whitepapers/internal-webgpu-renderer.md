# xeokit WebGPU Renderer Architecture and Rendering Techniques

## Abstract

The xeokit WebGPU renderer is a production renderer backend for the xeokit
Viewer. It keeps the public renderer contract aligned with the existing WebGL
backend while using WebGPU-native resource management, bind groups, render
pipelines, and command submission internally.

The renderer is designed for large BIM, CAD, city, point cloud, and streaming
workloads. Its primary technical goals are:

- Attach to the same `Viewer` and `View` model used by the WebGL renderer.
- Keep scene registration independent from GPU buffer layout.
- Pack geometry into large GPU pages to reduce draw overhead.
- Encode per-view and per-object state through compact uniform and instance
  buffers.
- Support progressive and streamed scene growth without rebuilding all GPU
  resources every frame.
- Provide renderer diagnostics for frame cost, batching, draw calls, memory, and
  optional GPU timestamps.

This document describes the current architecture and the rendering techniques
used by `packages/sdk/src/viewing/renderers/webGPU`.

## System Overview

The public entry point is `WebGPURenderer`. It owns the backend-neutral renderer
contract: device acquisition, viewer attachment, event bridging, lifecycle, and
error reporting. It does not own the detailed GPU render graph. Once attached,
it delegates WebGPU-specific rendering to `ViewManager`.

At a high level:

```text
Viewer / Scene / View
        |
        v
WebGPURenderer
        |
        v
ViewManager
        |
        +-- ViewRenderState
        +-- MeshManager
        +-- GeometryBufferManager
        +-- TriangleBatchManager / InstanceBatcher
        +-- InstanceBufferManager
        +-- FrameUniformManager / LightingManager / RTCTileManager
        +-- DrawOps / DrawTechnique implementations
        +-- RenderManager
        +-- PickManager / SnapManager
        +-- RenderInspector
```

This split preserves the existing xeokit mental model. Applications still attach
a renderer to a `Viewer`, create `View`s, mutate `SceneModel`s, and call picking
through the renderer API. Internally, the WebGPU backend maps that state into
GPU buffers and render passes.

## Public Backend Layer

`WebGPURenderer` is the public facade. It is responsible for:

- Requesting or accepting a `GPUDevice`.
- Requesting optional device features such as `timestamp-query` and
  `chromium-experimental-multi-draw-indirect` when the adapter exposes them.
- Requesting elevated `maxStorageBufferBindingSize` limits when available.
- Choosing the canvas texture format.
- Creating `MemoryConfigs` and `WebGPURenderConfigs`.
- Attaching and detaching from exactly one `Viewer`.
- Subscribing to viewer and scene lifecycle events.
- Deferring scene registrations while rendering is suspended.
- Forwarding view, scene, mesh, object, material, texture, and camera changes to
  `ViewManager`.
- Reporting errors through renderer events.
- Exposing diagnostics such as memory stats and render stats.

WebGPU device creation is asynchronous, while the backend-neutral renderer
contract is synchronous. For that reason, the preferred path is:

```ts
const rendererResult = await WebGPURenderer.create({viewer});
```

The constructor remains useful for injected devices, shared-device applications,
and tests, but `create()` is the browser-facing device acquisition path.

## Configuration Surfaces

The renderer has two major configuration groups.

`MemoryConfigs` controls GPU allocation strategy and capacities. It is consumed
by RTC storage, packed geometry pages, instance buffers, view culling, and the
streaming segment builder.

Important memory controls include:

- `maxViews`: bounds per-view WebGPU instance storage.
- `tileSize` and `maxTiles`: control relative-to-center tile allocation.
- `maxBatchVertices`, `maxBatchIndices`, `maxBatchGeometries`,
  `maxBatchMeshes`, and `maxBatchPrims`: bound packed segment size.
- `maxBatchBuildTimeMs` and `maxBatchBuildSegments`: bound streaming segment
  build work per render-cache rebuild.
- `frustumCulling` and `minProjectedCanvasSize`: suppress per-view draw batches
  without evicting packed geometry.
- `compactStreamPages` and `compactSealedStreamPages`: trade append headroom
  for lower packed-page memory use in streaming workloads.

`WebGPURenderConfigs` controls pass orchestration and shader strategy:

- `depthPrepass`: enables a depth-only opaque pass before color rendering.
- `logDepth`: enables logarithmic depth writes for large far planes.
- `edges`: enables edge batch construction and edge drawing.
- `triangleColorMode`: selects `"auto"`, `"pbr"` or `"flat"` triangle color
  packing and shaders. `"auto"` classifies batches internally, using the lean
  flat path for plain instance-colored triangles and the PBR path for batches
  that need textures, vertex colors, emissive terms, alpha-mask material state
  or non-default PBR material parameters.
- `gpuTimestamps`: enables WebGPU timestamp query instrumentation when the
  device supports it.
- `transparentSortStrategy`: selects segment-grouped or per-object transparent
  draw ordering.

Defaults currently favor the feature-complete PBR path for compatibility:

```ts
{
  depthPrepass: true,
  logDepth: false,
  edges: true,
  triangleColorMode: "pbr",
  gpuTimestamps: false,
  transparentSortStrategy: "segment"
}
```

Use `"auto"` when a scene mixes plain object-colored CAD/BIM content with
textured or materially rich assets and the renderer should choose the leanest
safe packing class per batch.

## Internal Coordinator: ViewManager

`ViewManager` is the top-level internal coordinator. It is created by
`WebGPURenderer` and owns all state that depends on the WebGPU device.

Its responsibilities are:

- Create one `ViewRenderState` per xeokit `View`.
- Register existing scene meshes when the renderer attaches.
- React to newly created, updated, and destroyed scene resources.
- Route view updates into `RenderManager`.
- Own the render inspector, pick manager, snap manager, mesh manager, and GPU
  memory managers.
- Tear down all WebGPU resources on renderer destruction.

The manager explicitly separates resource registration from rendering. Meshes
can be registered as they appear in a streamed model, while the render path
decides when to pack them, update instance data, rebuild cached render batches,
and submit commands.

## RenderContext

`RenderContext` is the shared dependency passed through the internal renderer.
It holds the WebGPU device, selected canvas format, memory configs, render
configs, and shared render resources such as IBL bind state and shadow bind
state.

This avoids threading global singleton state through individual draw techniques.
Draw techniques receive a compact context object and use manager-provided bind
group layouts and GPU resources.

## Scene Registration and Mesh State

`MeshManager` translates xeokit scene resources into renderer-side mesh state.
It tracks:

- Scene meshes supported by the WebGPU backend: triangles, points, lines, and
  Gaussian splats.
- Per-view object visibility, opacity, pickability, culling, and emphasis state.
- Geometry/material/texture properties needed for draw classification.
- Renderer mesh records used by batching and picking.

The renderer-side mesh registry is intentionally distinct from `SceneModel` and
`Scene` registries. Scene IDs remain strict; renderer-side registration can be
made tolerant around lifecycle events where appropriate without weakening scene
data integrity.

## GPU Memory Architecture

The WebGPU renderer uses data-oriented GPU memory managers. The important
managers are:

- `GeometryBufferManager`: owns raw geometry buffer resources.
- `TriangleBatchManager`: packs triangle meshes into GPU pages and segments.
- `InstanceBufferManager`: owns per-frame instance data buffers.
- `RTCTileManager`: uploads relative-to-center tile transforms.
- `TextureBindGroupManager`: manages texture bind groups for material textures.
- `SplatBatchManager`: batches Gaussian splats separately from triangle meshes.
- `BindGroupLayoutManager`: centralizes bind group layout creation.

### Packed Triangle Pages

Triangle geometry is packed into large pages. A page contains GPU buffers for:

- positions
- optional colors
- optional UVs
- optional normals
- material data
- vertex metadata
- indices
- edge indices
- position decode uniforms

Segments reference ranges within those pages. A segment is the draw-facing unit:
it carries buffer offsets, slot metadata, bind groups, index format, edge data,
texture key, world bounds, and the mesh slots it contains.

This is different from treating every scene mesh as a separate GPU allocation.
The packed model reduces bind and draw overhead and enables shared segment-level
draw calls.

### Instance Data

Per-object and per-view variation is uploaded through instance buffers rather
than duplicating geometry. Instance data encodes mesh transform, color, opacity,
state flags, pick color, RTC tile identity, and other shader-visible values.

For streaming workloads, the batch set also tracks projected instance capacity.
That lets the renderer allocate enough instance-buffer space for built and
pending segments and avoid unnecessary full-buffer churn.

### Page-Local and Segment-Local Indices

Some batches can use page-local indices: indices are valid relative to page
buffer offset zero. Others must remain segment-local because the vertex base
would exceed `uint16` range or because the packed layout requires per-segment
offsets.

This distinction matters for multi-draw and command encoding. Page-local
`uint32` batches are the best candidates for multi-draw indirect grouping,
while segment-local batches retain explicit offsets to avoid geometry
scrambling.

## Render Cache

`RenderManager` maintains a per-view render cache. The cache stores:

- structure version
- instance data version
- view state version
- render effect key
- camera version and snapshot
- transparency state
- total instance count
- current instance frame
- triangle batch set
- built instanced draw batches
- shadow, snap, and splat batch lists
- mesh state maps
- culling stats
- transparent bin cache

The cache is invalidated by structural scene changes, mesh state changes, view
state changes, camera changes, and render-mode/effect changes. The goal is to
avoid rebuilding draw batches when only command submission is required, while
still responding correctly to object visibility, culling, streaming, and
emphasis changes.

## Render Bin Classification

Before drawing, `RenderBinClassifier` partitions renderer meshes into bins:

- normal opaque
- normal transparent
- normal edges
- x-rayed fill and edges
- highlighted fill and edges
- selected fill and edges
- overlay opaque and transparent

The bins separate renderer state and draw semantics from scene ownership. They
also feed `InstanceBatcher`, which converts classified draw items into
`InstancedDrawBatch` objects that can be submitted through draw ops.

## DrawOps and DrawTechnique

`DrawOps` maps primitive types and render passes to `DrawOp` objects backed by
concrete `DrawTechnique` implementations.

Supported primitive families include:

- triangles
- points
- lines
- Gaussian splats

Triangle draw techniques currently cover:

- depth prepass
- shadow depth
- PBR color
- flat color
- edge color
- section plane caps
- stencil mask
- object picking
- vertex snapping
- edge snapping

Point and line paths have draw and pick techniques. Gaussian splats have
transparent draw and pick techniques and are batched separately from packed
triangle-family geometry.

This strategy matrix keeps pass routing in `RenderManager` while leaving shader
creation, pipeline creation, bind group compatibility, and draw encoding inside
techniques.

## Command State Tracking

`CommandStateTracker` records the currently bound pipeline and bind groups for a
render pass. Draw submitters use it to avoid redundant `setPipeline`,
`setBindGroup`, and buffer binding calls.

This matters because large BIM or city scenes can produce many logical draw
batches. Reducing redundant state changes lowers JavaScript command encoding
cost and helps stabilize frame time.

## Frame Uniforms

`FrameUniformManager` owns the uniform buffer and frame bind group used by
instanced mesh draws. Each frame it writes:

- WebGPU clip-space view-projection matrix
- ambient and directional light data
- section plane state and cap colors
- depth/log-depth parameters
- point and line material controls
- camera view matrix
- splat controls
- IBL resource bindings

RTC tile matrices are managed by `RTCTileManager`; instance data references RTC
tile slots when meshes need large-coordinate precision.

`LightingManager` extracts legacy flat ambient, directional lights,
hemispheric ambient, and IBL state from the `View` into packed frame uniform
fields.

The renderer applies the WebGPU clip-space conversion explicitly so scene and
camera math can remain consistent with the rest of xeokit.

## Render Pass Sequence

The main `RenderManager.renderView()` flow is:

1. Configure the canvas and depth resources for the `ViewRenderState`.
2. Build or reuse the per-view render cache.
3. Refresh splat batches.
4. Prepare IBL resources when triangle PBR rendering is active.
5. Write frame uniforms and instance bind groups.
6. Compute the WebGPU view-projection matrix.
7. Choose canvas or offscreen post-process color target.
8. Optionally render shadow maps.
9. Optionally render the opaque depth prepass.
10. Begin the main color pass.
11. Draw sky and infinite grid.
12. Draw opaque triangles, points, lines, and splats.
13. Draw edges when enabled.
14. Draw opaque emphasis layers.
15. Render section plane caps when active.
16. Draw transparent triangles, points, lines, splats, and transparent emphasis
    layers.
17. Draw overlays.
18. Run post-processing when required.
19. Resolve optional timestamp queries.
20. Submit commands and update render statistics.

The exact set of passes is data- and effect-dependent. Empty passes are skipped.

## Depth Prepass

The depth prepass is a depth-only pass over opaque triangle batches. It gives
later passes a stable depth buffer for:

- early depth rejection in the color pass
- section plane caps
- depth-aware post effects
- snap and pick support paths

It is enabled by default, but can be disabled for workloads where the extra
geometry pass costs more than it saves.

## Logarithmic Depth

`logDepth` enables logarithmic fragment depth writes in packed triangle shaders.
This improves depth precision for very large far planes and city-scale scenes.

The tradeoff is that writing fragment depth can disable early-Z optimizations
for affected shaders. For that reason, it is configurable and defaults to off
in the SDK renderer. Individual large-scene examples may enable it.

## Triangle Color Rendering

The PBR triangle shader consumes packed geometry attributes, instance state,
material parameters, optional material textures, section plane data, lighting,
IBL, shadows, and log-depth state.

The shader supports:

- per-object color and alpha
- alpha mask discard
- metallic/roughness material parameters
- base color, metallic-roughness, normal, emissive, and occlusion textures
- triplanar texture fallback for UV-less geometry
- flat ambient
- hemispheric ambient
- image-based lighting
- direct directional lighting
- shadow attenuation
- section clipping
- optional log-depth output

`triangleColorMode: "auto"` classifies triangle batches before packing. Plain
instance-colored triangles are placed on flat pages that do not allocate PBR
texture, UV, normal, material or vertex-color streams. Batches that need those
streams remain on PBR pages. This lets mixed scenes combine fast CAD-style
object-color rendering with textured or material-rich assets without forcing the
whole scene onto one path.

`triangleColorMode: "flat"` still forces every triangle batch onto the leaner
flat-color path. That mode is intended for extremely large streamed scenes where
memory and command cost dominate over material fidelity.

## Lighting Model

The renderer currently combines several lighting layers:

- legacy flat ambient from `AmbientLight`
- analytical hemispheric ambient from `view.lights.hemispheric`
- cubemap image-based lighting from `view.lights.ibl`
- up to three directional lights from `view.lightsList`
- emissive material contribution

The SDK defaults now keep the legacy auto-created flat ambient at zero
intensity, while hemispheric ambient and IBL are mode-gated. Hemispheric ambient
is cheap and suitable for navigation and detailed modes. IBL is reserved for
realistic rendering by default.

## IBL

`WebGPUIBLManager` prepares image-based lighting resources for the PBR shader.
It manages:

- procedural or image-derived environment source
- irradiance cubemap
- prefiltered specular cubemap
- BRDF LUT
- IBL uniform data
- fallback resources when no explicit environment is supplied

IBL is disabled in flat triangle color mode because that mode intentionally
avoids the material and texture cost of PBR shading.

## Shadows

`WebGPUShadowPipeline` implements directional shadow mapping. It builds one or
more cascade view-projection matrices, renders shadow-depth passes, uploads
shadow uniforms, and exposes a shadow bind group to the color shader.

The color shader samples a depth texture array with comparison sampling and
returns a visibility factor. That factor attenuates direct lighting. Indirect
ambient and IBL are not treated as cast-shadowed direct light.

The shadow system is configurable through `view.effects.shadows`, including
intensity, depth bias, slope bias, normal offset bias, resolution, auto-fit,
max distance, padding, PCF kernel size, cascade count, and split lambda.

## Edges and Emphasis

Edges are generated and submitted through separate edge batches and a dedicated
edge draw technique. The edge pass is controlled by both `renderConfigs.edges`
and the `View` edge effect's `enabled` state. Applications that need symbolic
rendering presets should drive that state through `ViewProfiles`.

Emphasis rendering uses separate batch lists for x-rayed, highlighted, and
selected fill and edge states. This preserves the existing xeokit emphasis
model while letting WebGPU submit compatible batches efficiently.

## Section Planes and Caps

Section planes are uploaded in frame uniforms. Triangle shaders discard clipped
fragments. When cap colors are active, `SectionPlaneCapRenderer` uses stencil
mask techniques and cap draw techniques to fill cut surfaces.

The cap path is separated from the normal color pass because it needs different
depth/stencil behavior and may require ending and reopening render passes.

## Transparent Rendering

Transparent rendering can be batched by packed segment or by object sort order.

Segment strategy is faster and is the default. It groups transparent draws by
GPU segment and reduces command overhead.

Object strategy can improve blending correctness for interleaved transparent
objects but can produce many more draw calls when objects span many packed
segments.

## Points, Lines, and Splats

The backend includes dedicated draw and pick techniques for points and lines.
Point rendering supports size and perspective-size controls through frame
uniforms. Line rendering has its own shader path and frame controls.

Gaussian splats are managed by `SplatBatchManager` and rendered through splat
draw and pick techniques. Splat sorting and advanced blending behavior remain
separate concerns from triangle batching.

## Picking and Snapping

`PickManager` owns WebGPU-backed picking. Because the public renderer pick API
is synchronous while WebGPU readback is asynchronous, the renderer supports two
paths:

- synchronous CPU-side picking from decoded renderer mesh data and view state
- asynchronous GPU object picking and snap readback where callers can await it

`SnapManager` supports vertex and edge snapping. GPU snap passes use dedicated
snap buffers and readback resources.

This hybrid design keeps existing synchronous picker callers working while
allowing WebGPU-native readback paths for newer async workflows.

## Post-Processing

`WebGPUPostProcessChain` selects whether rendering goes directly to the canvas
or into an offscreen scene color target. Post-process effects can then read the
scene color and depth outputs and composite to the canvas.

The current WebGPU post-process stack includes:

- SAO occlusion, optional depth-limited blur, and SAO composite
- bloom prefilter, downsample, upsample, and composite passes
- atmosphere depth fade
- depth of field
- color grading
- tonemapping and sRGB output conversion
- FXAA when anti-aliasing is enabled
- scene color render targets for offscreen HDR processing

Post-process use changes the color target format. Render pipeline creation must
match that target format, which is why the renderer tracks
`renderContext.colorTargetFormat` before beginning draw passes.

## Sky and Infinite Grid

The WebGPU backend includes environment renderers for sky and infinite grid.
They render early in the main color pass, before scene geometry. Their state is
owned by `RenderManager` and initialized alongside the rest of the render graph.

## RTC Precision

Large-world scenes use relative-to-center tile transforms to preserve numeric
precision. `RTCTileManager` writes tile matrices derived from the current
WebGPU view-projection matrix. Instance data references RTC tile slots so
shaders can reconstruct stable positions without pushing huge world-coordinate
values through all arithmetic.

This is critical for city-scale models and XGF streams.

## Streaming Behavior

Streaming workloads add meshes while a model is loading. The renderer addresses
this with:

- renderer-side mesh registration
- pending triangle segment build jobs
- projected instance capacity
- incremental instance writes where possible
- per-view render cache invalidation
- append-only render-cache updates followed by idle repacks when needed
- memory stats and build telemetry

The architecture distinguishes scene-level batch semantics from renderer packing
semantics. A streamed chunk may be meaningful to the loader, but it does not
need to become a permanent draw boundary. Compatible meshes can still share
packed pages and draw batches.

For WebGPU streams, `SceneModel.lifecycle` and `SceneModel.memoryPolicy` affect
segment grouping and page headroom. `SceneModel.updateHint` remains part of the
shared model contract, but the current WebGPU renderer does not use it to select
static versus dynamic storage.

## Diagnostics

`RenderInspector` and related stats classes capture:

- frame lifecycle
- render bins
- draw calls
- command encoder timing
- render-pass timing
- batch counts
- memory use
- optional GPU timestamps

Memory stats expose packed triangle pages and segments, used bytes, instance
buffer capacity, RTC tile buffers, and segment lifecycle counts.

These diagnostics are essential because WebGPU performance bottlenecks often
move between:

- scene registration
- segment packing
- GPU upload
- instance-buffer writes
- batch classification
- command encoding
- actual GPU pass time

## Performance Model

The renderer optimizes for large-scene throughput by moving work into large
contiguous GPU allocations and by reducing per-object draw submission.

Important performance levers are:

- batching compatible meshes into packed segments
- avoiding full instance uploads when only append ranges changed
- reusing render caches until structure or view state changes
- applying append-only cache updates during streaming, then rebuilding more
  compact/sorted batches after idle periods
- tracking command state to skip redundant WebGPU calls
- using automatic or forced flat triangle color packing for memory-constrained
  large streams
- using `compactStreamPages` or `compactSealedStreamPages` when memory footprint
  matters more than append headroom
- disabling edges, depth prepass, shadows, or PBR when they cost more than they
  help
- using real target hardware for multi-draw and command-encoding evaluation

The renderer is not purely GPU-bound. Large XGF streaming examples have shown
that command encoding and batch preparation can dominate some frames even when
segment build cost is low. The architecture therefore exposes instrumentation
rather than assuming a single bottleneck.

## Current Tradeoffs

The WebGPU renderer is a first-class backend, but WebGPU still has runtime and
feature variability. Important tradeoffs:

- WebGPU support depends on browser, adapter, flags, and device features.
- GPU readback is asynchronous, so synchronous pick APIs need compatibility
  paths.
- `getSnapshot()` is not implemented for WebGPU yet.
- Log-depth improves precision but can reduce early-Z efficiency.
- PBR and texture streams improve fidelity but increase memory pressure.
- Per-object transparent sorting improves blending but may increase draw calls.
- Shadow, SAO, IBL, bloom, tone mapping, and profile-managed effect settings
  can change both performance and visual brightness across `ViewProfiles`.
- WebGPU pipeline formats must match render targets exactly; post-process
  target formats affect pipeline compatibility.
- Multi-draw indirect behavior requires browser feature support and target
  hardware validation.

## Design Principles

The current design follows several practical principles:

- Preserve xeokit's public `Viewer` and `View` workflow.
- Keep scene identity strict while letting renderer packing be flexible.
- Separate draw classification from GPU memory layout.
- Prefer packed, reusable GPU resources over per-mesh allocations.
- Make expensive quality features independently mode-gated.
- Keep diagnostics close to the renderer instead of guessing at bottlenecks.
- Treat WebGL behavior as a compatibility reference where feature parity
  matters, but use WebGPU-native resource and pass structure internally.

## Conclusion

The xeokit WebGPU renderer is a data-oriented backend layered under the existing
Viewer API. Its core architecture is a public facade plus an internal manager
graph that handles registration, packing, batching, pass orchestration,
shading, picking, snapping, post-processing, and diagnostics.

The renderer's strongest fit is large streamed geometry where reducing draw
overhead and controlling GPU memory layout matter more than preserving one GPU
allocation per scene object. Its main engineering challenges are the same ones
seen in real WebGPU workloads: command encoding cost, cache invalidation,
streaming cadence, shader/pipeline compatibility, and making quality effects
scale without surprising visual transitions.
