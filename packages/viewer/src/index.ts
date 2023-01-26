/**
 * #### Browser-based model viewer
 *
 * * Builder API to programmatically create models
 * * Interact with model objects - show, hide, x-ray, highlight, colorize and slice
 * * Interactive camera -  mouse/touch, ortho, perspective, animations
 * * Load compressed geometry and textures (Basis)
 * * Double-precision coordinate accuracy (tiled coordinate system)
 * * Data-driven - state of viewer objects can be saved and loaded as JSON (or other)
 * * Browser graphics API agnostic - pluggable adapter for WebGL, WebGPU etc.
 * * Multiple canvases - when supported by the browser graphics API
 * * Extensible via plugins
 * * Localization support
 *
 * See {@link Viewer} for complete usage.
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl";
 * import {TrianglesPrimitive} from "@xeokit/core/constants";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({
 *         //...
 *     })
 * });
 *
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * const myViewerModel = myViewer.createModel({
 *     id: "myModel"
 * });
 *
 * myViewerModel.createGeometry({
 *     id: "myGeometry",
 *     primitive: TrianglesPrimitive,
 *     positions: [...],
 *     indices: [...]
 *     //...
 * });
 *
 * myViewerModel.createMesh({
 *     id: "myMesh",
 *     geometryId: "myGeometry",
 *     //...
 * });
 *
 * myViewerModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh"],
 *     //...
 * });
 *
 * myViewerModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh"],
 *     //...
 * });
 *
 * myViewerModel.build();
 * ````
 *
 * @packageDocumentation
 * @module @xeokit/viewer
 */

export * from "./Viewer";

/**
 * Key codes.
 */
export * as keycodes from "./keycodes";

/**
 * Interactive views
 */
export * from "./view/index";

/**
  * Compressed texture transcoders.
  */
export * from "./textureTranscoders/index";

export * from "./ViewerCapabilities";
export * from "./Plugin";
export * from "./localization/index";
export * from "./ViewParams";
export * from "./ViewerModel";
export * from "./ViewerModelParams";
export * from "./ViewerObject";
export * from "./Renderer";
