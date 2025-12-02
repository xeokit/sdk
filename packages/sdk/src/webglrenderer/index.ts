/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:100px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_webgl_logo.svg"/>
 *
 * # xeokit WebGL2 Renderer
 *
 * ---
 *
 * ### *Enables WebGL2 rendering in a xeokit Viewer*
 *
 * ---
 *
 * This module provides WebGL2-based rendering capabilities for the xeokit Viewer, offering:
 *
 * - Seamless integration with {@link viewer!Viewer | Viewer} via {@link WebGLRenderer}
 * - High-performance full-precision rendering of large-scale models
 * - Multi-canvas rendering support
 * - Basis-compressed textures for optimized performance
 * - Compressed geometry for reduced gpuMemoryManager footprint
 *
 * ## Installation
 *
 * To install the package, use:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * Configure a {@link viewer!Viewer | Viewer} with a {@link WebGLRenderer} to leverage WebGL2 for model storage and rendering:
 *
 * ````javascript
 * import { SDKErrorType } from "@xeokit/sdk/core";
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 *
 * const scene = new Scene();
 *
 * const viewer = new Viewer({
 *     scene
 * });
 *
 * const webglRenderer = new WebGLRenderer();
 *
 * const result = webglRenderer.attachViewer(viewer);
 *
 * if (!result.ok) {
 *    console.error("Failed to attach WebGLRenderer to Viewer:", result.error);
 * } else {
 *
 *    // WebGLRenderer begins rendering...
 *    // Listen for WebGLRenderer events
 *
 *     webglRenderer.events.onError.subscribe((renderer, result2) => {
 *          switch (result2.type) {
 *              case SDKErrorType.NotSupported:
 *                  console.error("WebGLRenderer not supported:", result2.error);
 *                  break;
 *              case SDKErrorType.OutOfMemory:
 *                  console.error("WebGLRenderer out of memory:", result2.error);
 *                  break;
 *              default:
 *                  console.error("WebGLRenderer error:", result2.error);
 *          }
 *     });
 *
 *     webglRenderer.events.onDestroyed.subscribe((renderer, _) => {
 *          console.log("WebGLRenderer destroyed.");
 *     });
 * }
 *
 * ````
 *
 * @module webglrenderer
 */
export {WebGLRenderer} from "./WebGLRenderer";
export {WebGLRendererEvents} from "./WebGLRendererEvents";
export {GPUMemoryConfigs} from "./GPUMemoryConfigs";
export {createGPUMemoryConfigs} from "./createGPUMemoryConfigs";
export {GPUMemoryUsage} from "./GPUMemoryUsage";
