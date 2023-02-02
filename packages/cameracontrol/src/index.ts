/**
 * ## Camera Controls
 *
 * * TODO
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/input
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl";
 * import {CameraControl, keycodes} from "@xeokit/input";
 * *
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
 *
 * ````
 *
 * @module @xeokit/cameracontrol
 */
export * from "./CameraControl/CameraControl";
export * as keycodes from "./keycodes"