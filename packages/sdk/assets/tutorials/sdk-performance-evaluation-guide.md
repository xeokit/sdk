# xeokit SDK Performance Evaluation Guide

Use this guide to evaluate xeokit SDK rendering, loading, streaming and view-effect
performance across WebGL and WebGPU.

Serve the website examples first:

```bash
./node_modules/.bin/http-server packages/website -p 8097 --bind 127.0.0.1
```

Then open examples at:

```text
http://127.0.0.1:8097/examples/<example-id>/
```

For WebGPU, use a WebGPU-capable browser and adapter. When comparing renderers,
use the same machine, browser build, display scale, window size, camera path and
effect settings.

## What To Measure

- **Startup:** time to first canvas, time to first model content, time to stable
  frame rate after load.
- **Navigation:** FPS and frame-time spikes while orbiting, panning, zooming and
  walking through dense areas.
- **Streaming:** time to first visible chunks, request fan-out, memory growth,
  stalls while moving the camera, settled memory after navigation stops.
- **Renderer effects:** cost of SAO, shadows, transparency, style bins, edges,
  material features and adaptive quality.
- **Mutation:** cost of creating, deleting and changing object state at runtime.
- **Memory:** JS heap, GPU memory where available, loaded chunk count, draw-count
  stability and whether resources are released after unloading or destroying.

## Renderer Comparison Examples

These pages are the fastest way to compare WebGL and WebGPU visually because
they run both renderers side by side against the same scene or diagnostic setup.

| Example | Use It For |
| --- | --- |
| [![Shared scene](sdk-performance-evaluation-guide/shared-scene.png)](../../../../packages/website/examples/view/renderers/webgl-webgpu-shared-scene/)<br>[WebGL + WebGPU - Shared Scene](../../../../packages/website/examples/view/renderers/webgl-webgpu-shared-scene/) | Baseline WebGL/WebGPU parity on the same `Scene` and `Data` graph. |
| [![Material parity](sdk-performance-evaluation-guide/material-parity.png)](../../../../packages/website/examples/view/renderers/webgl-webgpu-material-parity/)<br>[Material Feature Parity](../../../../packages/website/examples/view/renderers/webgl-webgpu-material-parity/) | Material and lighting cost: IBL, metal, rough dielectric, clearcoat, alpha, emissive and sheen paths. |
| [![SAO quality](sdk-performance-evaluation-guide/sao-quality.png)](../../../../packages/website/examples/view/renderers/webgl-webgpu-sao-quality/)<br>[SAO Quality](../../../../packages/website/examples/view/renderers/webgl-webgpu-sao-quality/) | SAO cost and quality, including depth, normals, raw occlusion, blur and final factor views. |
| [![Shadow quality](sdk-performance-evaluation-guide/shadow-quality.png)](../../../../packages/website/examples/view/renderers/webgl-webgpu-shadow-quality/)<br>[Shadow Quality](../../../../packages/website/examples/view/renderers/webgl-webgpu-shadow-quality/) | Shadow quality and cost for opaque, thin, alpha-masked and transparent casters. |
| [![Transparency quality](sdk-performance-evaluation-guide/transparency-quality.png)](../../../../packages/website/examples/view/renderers/webgl-webgpu-transparency-quality/)<br>[Transparency Quality](../../../../packages/website/examples/view/renderers/webgl-webgpu-transparency-quality/) | Sorting, overdraw and visual quality for alpha-mask foliage, glass and overlapping transparent layers. |
| [![Style bins](sdk-performance-evaluation-guide/style-bins.png)](../../../../packages/website/examples/view/renderers/webgl-webgpu-style-bins/)<br>[Style Bins](../../../../packages/website/examples/view/renderers/webgl-webgpu-style-bins/) | Runtime object state changes with user-defined style bins on WebGL and WebGPU. |

## Streaming And Large-Model Examples

Use these to evaluate load latency, chunk scheduling, memory pressure and camera
stall behavior. The Baku set is useful because it has multiple partitioning and
storage variants.

| Example | Renderer Coverage | Use It For |
| --- | --- | --- |
| [![Baku 200 static](sdk-performance-evaluation-guide/baku-200-static.png)](../../../../packages/website/examples/streaming/xgf/baku-200-static/)<br>[Baku Stadium, 200 Chunks, Static](../../../../packages/website/examples/streaming/xgf/baku-200-static/) | WebGL static VBO | Coarse partitioning baseline and static VBO upload cost. |
| [![Baku 2K dynamic](sdk-performance-evaluation-guide/baku-2000-dynamic.png)](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-2000-dynamic/)<br>[Baku Stadium, 2K Chunks, Dynamic](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-2000-dynamic/) | WebGL dynamic/DTX | Fast-load streaming baseline, cache limits, first-frustum latency and camera-stall tuning. |
| [![Baku 4K dynamic](sdk-performance-evaluation-guide/baku-4000-dynamic.png)](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-4000-dynamic/)<br>[Baku Stadium, 4K Chunks, Dynamic](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-4000-dynamic/) | WebGL dynamic/DTX | High chunk-count request fan-out and memory pressure. |
| [![Baku 4K static](sdk-performance-evaluation-guide/baku-4000-static.png)](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-4000-static/)<br>[Baku Stadium, 4K Chunks, Static](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-4000-static/) | WebGL static VBO | Small-chunk scheduling and settled static-rendering behavior. |
| [WebGPU - Streaming Baku Stadium as XGF](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-webgpu/) | WebGPU | WebGPU dynamic SceneModel streaming with `XGFViewStreamController`. |
| [![Recursive XGF](sdk-performance-evaluation-guide/recursive-streaming.png)](../../../../packages/website/examples/streaming/xgf/recursive/)<br>[Recursive Streaming - Nested Model Set](../../../../packages/website/examples/streaming/xgf/recursive/) | WebGL | Multi-model stream scheduling with independent child stream bounds. |
| [![Hospital stream](sdk-performance-evaluation-guide/hospital-static.png)](../../../../packages/website/examples/streaming/xgf/west-river-side-hospital-static/)<br>[West Riverside Hospital Static](../../../../packages/website/examples/streaming/xgf/west-river-side-hospital-static/) | WebGL static VBO | Building-scale stream scheduling, review viewpoints and static model navigation. |

## Scene And Mutation Benchmarks

These are useful for runtime mutation, object count and scene-model overhead.

| Example | Renderer Coverage | Use It For |
| --- | --- | --- |
| [![Procedural cityscape](sdk-performance-evaluation-guide/procedural-cityscape.png)](../../../../packages/website/examples/benchmarks/scene/procedural-cityscape/)<br>[Procedural Cityscape](../../../../packages/website/examples/benchmarks/scene/procedural-cityscape/) | WebGL | Repeated geometry, high object count and city-scale navigation. |
| [![Create and destroy](sdk-performance-evaluation-guide/create-destroy.png)](../../../../packages/website/examples/benchmarks/scene/stress-test/)<br>[Create & Destroy Meshes](../../../../packages/website/examples/benchmarks/scene/stress-test/) | WebGL | SceneModel, Viewer and renderer churn under continuous mesh creation/deletion. |
| [WebGPU - Creating a 3D Model Benchmark](../../../../packages/website/examples/benchmarks/scene/stress-test-webgpu/) | WebGPU | WebGPU dynamic geometry, mesh and object creation/deletion. |
| [![Adaptive quality](sdk-performance-evaluation-guide/adaptive-quality.png)](../../../../packages/website/examples/view/profiles/adaptive-quality/)<br>[AdaptiveQuality - ViewProfiles](../../../../packages/website/examples/view/profiles/adaptive-quality/) | WebGL | Profile switching cost while navigating versus at rest. |

## WebGPU-Specific Checks

Use these after the side-by-side pages when the evaluator wants to isolate
WebGPU behavior.

| Example | Use It For |
| --- | --- |
| [Render Path Matrix Controls](../../../../packages/website/examples/view/webgpu/render-path-matrix/) | Switch geometry, material, effect and renderer-backend combinations interactively. |
| [Render Path Tests](../../../../packages/website/examples/view/webgpu/render-path-matrix-gallery/) | Compare captured WebGPU and WebGL render-path permutations. |
| [WebGPU Object States](../../../../packages/website/examples/view/webgpu/object-states/) | Per-object style-bin, colorize, opacity and visibility updates. |
| [WebGPU RTC Tiles](../../../../packages/website/examples/view/webgpu/rtc-tiles/) | Large-coordinate RTC tile assignment and per-mesh updates without geometry rebuild. |
| [WebGPU Table Shadows](../../../../packages/website/examples/view/webgpu/table-shadows/) | Simple generated shadow scene for a quick WebGPU sanity check. |

## Suggested Evaluation Order

1. Start with [Shared Scene](../../../../packages/website/examples/view/renderers/webgl-webgpu-shared-scene/) to confirm both renderers initialize on the machine.
2. Run [Material Feature Parity](../../../../packages/website/examples/view/renderers/webgl-webgpu-material-parity/) with expensive features toggled off, then on.
3. Run [SAO Quality](../../../../packages/website/examples/view/renderers/webgl-webgpu-sao-quality/) and [Shadow Quality](../../../../packages/website/examples/view/renderers/webgl-webgpu-shadow-quality/) independently before combining effects in application scenes.
4. Run [Baku 2K Dynamic](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-2000-dynamic/) and [WebGPU Baku](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-webgpu/) for streaming behavior.
5. Compare [Baku 4K Dynamic](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-4000-dynamic/) against [Baku 4K Static](../../../../packages/website/examples/benchmarks/streaming/xgf-baku-4000-static/) to understand DTX versus VBO tradeoffs.
6. Use [Create & Destroy Meshes](../../../../packages/website/examples/benchmarks/scene/stress-test/) and [WebGPU Creating a 3D Model Benchmark](../../../../packages/website/examples/benchmarks/scene/stress-test-webgpu/) for mutation-heavy applications.

## Recording Results

For each run, record:

- Browser name and version.
- GPU adapter and driver, where available.
- Renderer: WebGL, WebGPU, or side-by-side.
- Example ID and git commit.
- Display scale, viewport size and device pixel ratio.
- Initial load time, time to first visible model content and settled FPS.
- Peak and settled JS heap.
- Any WebGPU device loss, WebGL context loss or shader compile warnings.
- Notes on visual correctness, especially for SAO, shadows, transparency and
  style-bin overlays.

Treat browser screenshots or pixel-readback probes as visual evidence. Passing
builds, tests, console success and draw-call counters are useful, but they are
not by themselves proof that a graphics feature rendered correctly.
