/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:190px;" src="media://images/xeokit_webgpu_logo.svg"/>
 *
 * ## WebGPU-Based Rendering Strategy for a {@link @xeokit/viewer!Viewer | Viewer}
 *
 * * Plug a {@link WebGPURenderer} into a {@link @xeokit/viewer!Viewer} to use WebGPU for model storage and rendering.
 * * This is work-in-progress. We recommend using {@link @xeokit/webgl} until this strategy is ready.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/webgpu
 * ````
 *
 * ## Usage
 *
 * Configuring a {@link @xeokit/viewer!Viewer} with a {@link WebGPURenderer} to use the browser's WebGPU
 * graphics API for storing and rendering models:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGPURenderer} from "@xeokit/webgpu";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGPURenderer({ // Mandatory
 *          textureTranscoder: new KTX2TextureTranscoder({ // Optional
 *              transcoderPath: "./../dist/basis/" // <------ Path to BasisU transcoder module
 *          })
 *     })
 * });
 *
 * //...
 * ````
 *
 * @module @xeokit/webgpu
 */
export * from "./WebGPURenderer";