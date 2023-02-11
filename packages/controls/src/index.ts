/**
 * <img style="padding:30px" src="media://images/xeokit_controls_icon.png"/>
 *
 * ## Camera Navigation Controls
 *
 * * {@link CameraControl} - controls a {@link @xeokit/viewer!View | View's} {@link @xeokit/viewer!Camera}
 * * Reads touch, mouse and keyboard input
 * * Three navigation modes: "orbit", "firstPerson" and "planView"
 * * Dynamic key mapping
 * * Smart-pivot
 * * Move-to-pointer
 * * Distance-scaled rate of movement
 * * Inertia
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/controls
 * ````
 *
 * ## Usage
 *
 * Using a {@link CameraControl} to control a {@link @xeokit/viewer!View | View's} {@link @xeokit/viewer!Camera} :
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl";
 * import {CameraControl} from "@xeokit/controls";
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