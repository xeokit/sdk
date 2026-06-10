/**
 * <img
 *   style="padding-top:20px; padding-bottom:30px; height:100px;"
 *   src="../../assets/xeokit_webgl_logo.svg"
 * />
 *
 * # xeokit WebGL Renderer
 *
 * ---
 *
 * ***WebGL2-based rendering backend for xeokit Viewers***
 *
 * ---
 *
 * ## Overview
 *
 * This module provides a WebGL2 rendering backend for the xeokit
 * {@link viewing!viewer.Viewer | Viewer}. It manages GPU-resident
 * rendering data, issues draw calls, and keeps GPU state synchronised
 * with Scene and View changes.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class WebGLRenderer {
 *       +events           : WebGLRendererEvents
 *       +memoryConfigs    : MemoryConfigs
 *       +attachViewer(viewer)
 *       +detachViewer()
 *       +getMemoryUsage() MemoryUsage
 *       +getCapabilities() Capabilities
 *       +getMemoryInspector() / getShaderInspector() / getRenderInspector()
 *       +pick(params) PickResult
 *       +destroy()
 *     }
 *     class WebGLRendererEvents {
 *       +onViewerAttached / onViewerDetached
 *       +onRendererStarted / onRendererStopped
 *       +onViewRendered
 *       +webglContextLost / webglContextRestored
 *       +onError
 *     }
 *     class MemoryConfigs {
 *       +maxViews / maxTiles / maxBatches
 *       +maxBatchVertices / maxBatchIndices
 *       +tileSize
 *     }
 *     class MemoryUsage {
 *       +allocatedMB / usedMB
 *     }
 *     class Capabilities {
 *       +extensions / limits
 *     }
 *     class Viewer {
 *       <<viewer>>
 *     }
 *     class internal {
 *       <<sub-module>>
 *       ViewManager / RenderManager
 *       MeshManager / GPUMemoryManager
 *       PickManager / DrawOps
 *     }
 *     WebGLRenderer "1" *-- "1" WebGLRendererEvents
 *     WebGLRenderer "1" *-- "1" MemoryConfigs
 *     WebGLRenderer ..> MemoryUsage : returns
 *     WebGLRenderer ..> Capabilities : returns
 *     WebGLRenderer o-- Viewer : attaches
 *     WebGLRenderer "1" *-- "1" internal : delegates
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Tight Viewer integration** — attach via `WebGLRenderer.attachViewer(viewer)`;
 *   the renderer observes Scene + Viewer events and keeps the GPU
 *   state in lockstep automatically.
 * - **Full-precision rendering** — tile-based modelling matrices +
 *   camera-relative tiles keep GPU positions near the origin even for
 *   real-world-scale models, so double-precision content renders
 *   without z-fighting or shimmer.
 * - **Batched + sorted draws** — meshes pack into GPU batches sized
 *   to the configured budget; per-frame sorting minimises material /
 *   shader switches.
 * - **Multi-canvas rendering** — a single renderer drives any number
 *   of {@link viewing!viewer.View | Views}; each `View` paints into
 *   its own canvas.
 * - **Configurable GPU memory budgeting** — pass
 *   {@link MemoryConfigs} to `attachViewer` to size batches /
 *   tiles / atlases against the host's memory envelope.
 * - **GPU memory + shader inspection** — `getMemoryInspector` /
 *   `getShaderInspector` expose deep diagnostics for tooling
 *   panels.
 * - **Picking** — `pick(params)` performs GPU readback for
 *   snap-to-vertex / snap-to-edge picks the BVH path can't answer.
 * - **WebGL context restoration** — on `webglcontextlost` /
 *   `webglcontextrestored`, the renderer rebuilds its GPU state
 *   transparently without losing scene data.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Usage
 *
 * Attach a {@link WebGLRenderer} to a {@link viewing!viewer.Viewer | Viewer} to enable WebGL2-based
 * storage and rendering of scene data:
 *
 * ```ts
 * import { SDKErrorType } from "@xeokit/sdk/base/core";
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 *
 * const scene = new Scene();
 * const viewer = new Viewer();
 * const webglRenderer = new WebGLRenderer();
 *
 * // Subscribe to renderer lifecycle and error events as needed
 *
 * webglRenderer.events.onError.subscribe((renderer, err) => {
 *   switch (err.type) {
 *     case SDKErrorType.NotSupported:
 *       console.error("WebGL2 not supported:", err.error);
 *       break;
 *     case SDKErrorType.OutOfMemory:
 *       console.error("GPU memory exhausted:", err.error);
 *       break;
 *     default:
 *       console.error("WebGLRenderer error:", err.error);
 *   }
 * });
 *
 * // Attach the Scene to the Viewer and the WebGLRenderer to the Viewer
 *
 * const res1 = viewer.attachScene(scene);
 * if (!res1.ok) {
 *   console.error("Failed to attach Scene:", res1.error);
 * }
 *
 * const res2 = webglRenderer.attachViewer(viewer);
 * if (!res2.ok) {
 *   console.error("Failed to attach WebGLRenderer to Viewer:", res2.error);
 * }
 * ```
 *
 * <br>
 *
 * ## Reading Memory Usage
 *
 * You can monitor GPU memory usage via the {@link MemoryUsage} interface, accessible from
 * {@link WebGLRenderer.getMemoryUsage}:
 *
 * ```ts
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 *
 * const webglRenderer = new WebGLRenderer();
 *
 * const memoryUsage = webglRenderer.getMemoryUsage();
 *
 * console.log("Allocated Memory (MB):", memoryUsage.allocatedMB);
 * console.log("Used Memory (MB):", memoryUsage.usedMB);
 * ```
 *
 * <br>
 *
 * ## Configuring GPU Memory Limits
 *
 * The {@link MemoryConfigs} interface allows you to configure GPU memory usage for the
 * {@link WebGLRenderer}. This defines a budget that the renderer adheres to when allocating
 * textures, indices, and vertex buffers.
 *
 * The easiest way to create memory configurations is with {@link createMemoryConfigs}:
 *
 * ```ts
 * import { createMemoryConfigs } from "@xeokit/sdk/viewing/webGLRenderer";
 *
 * const memoryConfigs = createMemoryConfigs({
 *   grossMemoryMB: 500,      // Max GPU memory in MB
 *   user: {
 *     // Optional overrides
 *   },
 *   device: "high",          // "low" | "medium" | "high"
 *   utilization: 0.8         // Fraction of grossMemoryMB to use
 * });
 *
 * const webglRenderer = new WebGLRenderer({ memoryConfigs });
 * ```
 *
 * A more manual approach is to directly implement {@link MemoryConfigs}:
 *
 * ```ts
 * import { MemoryConfigs } from "@xeokit/sdk/viewing/webGLRenderer";
 *
 * const memoryConfigs: MemoryConfigs = {
 *   maxTiles: 512,
 *   maxBatches: 128,
 *   maxBatchVertices: 500000,
 *   maxBatchIndices: 800000,
 *   maxBatchGeometries: 2000,
 *   maxBatchMeshes: 2000,
 *   maxBatchPrims: 400000
 * };
 *
 * const webglRenderer = new WebGLRenderer({ memoryConfigs });
 * ```
 *
 * <br>
 *
 * ## Internal Diagnostics API
 *
 * The {@link internal} namespace exposes internal diagnostics and debugging facilities
 * used by the WebGLRenderer implementation itself. These APIs provide deep visibility
 * into GPU-resident resources, shader programs, command submission, and internal
 * rendering state while the renderer is running.
 *
 * This namespace is **not part of the public API** and is intended solely for
 * xeokit SDK development and debugging. It is not supported for application use
 * and may change or be removed without notice.
 *
 * @module webGLRenderer
 */
export * from "./WebGLRenderer";
export * from "./WebGLRendererEvents";
export * from "./Capabilities";
export * from "./MemoryConfigs";
export * from "./createMemoryConfigs";
export * from "./MemoryUsage";

export * as internal from "./internal";
