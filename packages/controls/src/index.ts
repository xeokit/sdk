/**
 * ## Input Controls
 *
 * * {@link CameraControl} - controls a {@link View|View's} {@link Camera}
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/controls
 * ````
 *
 * ## Usage
 *
 * Using a {@link CameraControl} to control a {@link View|View's} {@link Camera}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl";
 * import {CameraControl, keycodes} from "@xeokit/controls";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({
 *         //...
 *     })
 * });
 *
 * const myView = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * const myCameraControl = new CameraControl({
 *      view: myView
 * });
 *
 * //...
 * ````
 *
 * @module @xeokit/controls
 */
export * from "./CameraControl/CameraControl";
export * as keycodes from "./keycodes"