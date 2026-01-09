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
 * @module webglrenderer
 */
export * from "./WebGLRenderer";
export * from "./WebGLRendererEvents";
export * from "./MemoryConfigs";
export * from "./createMemoryConfigs";
export * from "./MemoryUsage";

export * as internal from "./internal";
