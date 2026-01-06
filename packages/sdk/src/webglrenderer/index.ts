/**
 * <img
 *   style="padding-top:20px; padding-bottom:30px; height:100px;"
 *   src="https://xeokit.github.io/sdk/docs/assets/xeokit_webgl_logo.svg"
 * />
 *
 * # xeokit WebGL2 Renderer
 *
 * ---
 *
 * ### *WebGL2-based rendering backend for xeokit Viewers*
 *
 * ---
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
 * ## Installation
 *
 * Install via npm:
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
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
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 *
 * const scene = new Scene();
 *
 * const viewer = new Viewer({ scene });
 *
 * const webglRenderer = new WebGLRenderer();
 *
 * const result = webglRenderer.attachViewer(viewer);
 *
 * if (!result.ok) {
 *   console.error("Failed to attach WebGLRenderer:", result.error);
 *   return;
 * }
 *
 * // Rendering begins once a Scene is attached to the Viewer.
 * // Subscribe to renderer lifecycle and error events as needed.
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
 * webglRenderer.events.onRendererDestroyed.subscribe(() => {
 *   console.log("WebGLRenderer destroyed.");
 * });
 * ```
 *
 * ## Diagnostics and tooling
 *
 * The renderer exposes structured inspection APIs for debugging and tooling:
 *
 * - {@link MemoryUsage} provides a summary of GPU memory consumption
 * - {@link MemoryView} exposes read-only access to GPU-resident {@link DataTextures}
 * - Debugger utilities can visualize batch layouts, data textures, and draw ranges
 *
 * These APIs are intended for diagnostics and monitoring and do not allow direct mutation
 * of renderer-owned GPU state.
 *
 * The example below demonstrates how to use these APIs. In the example, we obtain a summary of GPU memory usage,
 * access the GPU-resident data textures, and retrieve debug views of specific render batches, meshes, and geometries.
 * We also show how to access the scene components corresponding to these GPU resources, which can be useful for
 * debugging and analysis.
 *
 *
 * ```ts
 * // Get GPU memory usage summary
 * const memoryUsage: MemoryUsage = webglRenderer.getMemoryUsage();
 * console.log(`GPU Memory Usage: ${memoryUsage.usedMB} MB used of ${memoryUsage.totalMB} MB total`);
 *
 * // Get read-only debug view of GPU-resident data
 *
 * const memoryView: MemoryView = webglRenderer.getMemoryView();
 * const dataTextures = memoryView.dataTextures;
 *
 * // Get a debug view of a specific render batch
 *
 * const batches = dataTextures.batches;
 * const batchIndex = 0;
 * const batch0 = batches[batchIndex];
 *
 * // Get a debug view of a specific mesh in the batch
 *
 * const meshAttribs0 = batch0.meshAttributes.getItem(0);
 * const meshIndex = meshAttribs0.meshIndex;
 * const sceneMesh = memoryView.getMeshAtIndex(batchIndex, meshIndex);
 *
 * // Get a debug view of a specific geometry in the batch
 *
 * const geometryIndex = meshattribs0.geometryIndex;
 * const sceneGeometry = memoryView.getGeometryAtIndex(batchIndex, geometryIndex);
 * const geometryAttribs = batch0.geometryAttributes.getItem(geometryIndex);
 * const verticesBase = geometryAttribs.verticesBase;
 * const vertexPosition = batch0.vertexPositions.getItem(verticesBase); // Vec3
 * ```
 *
 * @module webglrenderer
 */
export * from "./WebGLRenderer";
export * from "./WebGLRendererEvents";
export * from "./MemoryConfigs";
export * from "./createMemoryConfigs";
export * from "./MemoryUsage";
export * from "./MemoryView";
export * from "./viewManager/gpuMemoryManager/dtx/DataTexture";
export * from "./viewManager/gpuMemoryManager/BatchDataTextures";
export * from "./viewManager/gpuMemoryManager/DataTextures";
export * from "./MemoryDebugger";
export * from "./viewManager/gpuMemoryManager/dtx/PrimRange";
