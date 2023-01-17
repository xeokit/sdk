/**
 * #### Configures a {@link Viewer} to use WebGL for mesh storage and rendering
 *
 * * Compact texture-based scene representation
 * * Physically-based materials
 * * Compressed textures
 * * Compressed geometry
 * * Double-precision rendering
 *
 * Configure your {@link Viewer} with a {@link WebGLRenderer} to use the browser's WebGL
 * graphics API for storing and rendering meshes.
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