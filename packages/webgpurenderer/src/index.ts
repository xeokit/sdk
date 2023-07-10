/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fwebgpu.svg)](https://badge.fury.io/js/%40xeokit%2Fwebgpu)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/webgpurenderer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/webgpurenderer)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:190px;" src="media://images/xeokit_webgpu_logo.svg"/>
 *
 * # xeokit WebGPU Renderer
 *
 * ---
 *
 * ### *Configures a xeokit Viewer to use WebGPU for rendering*
 *
 * ---
 *
 * * Plug a {@link WebGPURenderer} into a {@link @xeokit/viewer!Viewer} to use WebGPU for model storage and rendering.
 * * This is work-in-progress. We recommend using {@link @xeokit/webglrenderer} until this strategy is ready.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/webgpurenderer
 * ````
 *
 * ## Usage
 *
 * Configuring a {@link @xeokit/viewer!Viewer} with a {@link WebGPURenderer} to use the browser's WebGPU
 * graphics API for storing and rendering models:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGPURenderer} from "@xeokit/webgpurenderer";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene: new Scene(),
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
 * @module @xeokit/webgpurenderer
 */
export * from "./WebGPURenderer";