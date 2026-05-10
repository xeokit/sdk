/**
 * <img
 *   style="padding-top:20px; padding-bottom:30px; height:100px;"
 *   src="https://xeokit.github.io/sdk/docs/assets/xeokit_webgl_logo.svg"
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
 * This module provides a WebGL2 rendering backend for the xeokit {@link viewer!Viewer | Viewer}.
 * It is responsible for managing GPU-resident rendering data, issuing draw calls,
 * and keeping GPU state synchronized with scene and view changes.
 *
 * Key features include:
 *
 * - Tight integration with {@link viewer!Viewer | Viewer} via {@link WebGLRenderer}
 * - High-performance, full-precision rendering of large-scale models
 * - Efficient batching and sorted rendering to minimize draw calls
 * - Multi-canvas rendering support
 * - GPU memory management with configurable budgeting
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
 * Attach a {@link WebGLRenderer} to a {@link viewer!Viewer | Viewer} to enable WebGL2-based
 * storage and rendering of scene data:
 *
 * ```ts
 * import { SDKErrorType } from "@xeokit/sdk/core";
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/webGLRenderer";
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
 * import { WebGLRenderer } from "@xeokit/sdk/webGLRenderer";
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
 * import { createMemoryConfigs } from "@xeokit/sdk/webGLRenderer";
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
 * import { MemoryConfigs } from "@xeokit/sdk/webGLRenderer";
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
export * from "./MemoryConfigs";
export * from "./createMemoryConfigs";
export * from "./MemoryUsage";

export * as internal from "./internal";
