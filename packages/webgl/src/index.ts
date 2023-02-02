/**
 * <img src="https://xeokit.github.io/xeokit-sdk/assets/images/autzen.png"/>
 *
 * ## WebGL Rendering Strategy for Viewer
 *
 * * Plug a {@link WebGLRenderer} into a {@link Viewer} to use WebGL for model storage and rendering
 * * Compact texture-based model representation
 * * Fast full-precision rendering of large models
 * * Physically-based materials
 * * Basis-compressed textures
 * * Compressed geometry
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/viewer
 * ````
 *
 * ## Usage
 *
 * Configuring a {@link Viewer} with a {@link WebGLRenderer} to use the browser's WebGL
 * graphics API for storing and rendering models:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ // Mandatory
 *          textureTranscoder: new KTX2TextureTranscoder({ // Optional
 *              transcoderPath: "./../dist/basis/" // <------ Path to BasisU transcoder module
 *          })
 *     })
 * });
 *
 * //...
 * ````
 *
 * @module @xeokit/webgl
 */
export * from "./WebGLRenderer";