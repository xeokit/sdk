/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fwebgl.svg)](https://badge.fury.io/js/%40xeokit%2Fwebgl)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/webglrenderer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/webglrenderer)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:100px;" src="media://images/xeokit_webgl_logo.svg"/>
 *
 * # xeokit WebGL2 Renderer
 *
 * ---
 *
 * ### *Configures a xeokit Viewer to use WebGL2 for graphics*
 *
 * ---
 *
 * * Plug a {@link WebGLRenderer} into a {@link @xeokit/viewer!Viewer | Viewer} to use WebGL for model storage and rendering
 * * Compact texture-based model representation
 * * Fast full-precision rendering of large models
 * * Physically-based materials
 * * Multi-canvas
 * * Basis-compressed textures
 * * Compressed geometry
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/webglrenderer
 * ````
 *
 * ## Usage
 *
 * Configuring a {@link @xeokit/viewer!Viewer | Viewer} with a {@link WebGLRenderer} to use the browser's WebGL
 * graphics API for storing and rendering models:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene: new Scene(),
 *     renderers: new WebGLRenderer({ // Mandatory
 *          textureTranscoder: new KTX2TextureTranscoder({ // Optional
 *              transcoderPath: "./../dist/basis/" // <------ Path to BasisU transcoder module
 *          })
 *     })
 * });
 *
 * //...
 * ````
 *
 * @module @xeokit/webglrenderer
 */
export {WebGLRenderer} from "./WebGLRenderer";
export {createSceneModelStreamParams} from "./createSceneModelStreamParams";
