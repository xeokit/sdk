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
 * - Compressed geometry for reduced memory footprint
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
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene: new Scene(),
 *     renderer: new WebGLRenderer({ // Required
 *          textureTranscoder: new KTX2TextureTranscoder({ // Optional
 *              transcoderPath: "./../dist/basis/" // Path to BasisU transcoder module
 *          })
 *     })
 * });
 *
 * //...
 * ````
 *
 * @module webglrenderer
 */
export {WebGLRenderer} from "./WebGLRenderer";
