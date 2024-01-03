/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcontrols.svg)](https://badge.fury.io/js/%40xeokit%2Fcontrols)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/cameracontrol/badge)](https://www.jsdelivr.com/package/npm/@xeokit/cameracontrol)
 *
 * <img style="padding:30px" src="media://images/xeokit_controls_icon.png"/>
 *
 * # xeokit Camera Controls
 *
 * ---
 *
 * ### *Navigate a Viewer's camera with mouse and touch input*
 *
 * ---
 *
 * * Use {@link CameraControl} to control a {@link @xeokit/viewer!Camera}, which belongs to a {@link @xeokit/viewer!View | View}, which belongs to a {@link @xeokit/viewer!Viewer | Viewer}.
 * * Reads touch, mouse and keyboard input
 * * Three navigation modes: OrbitNavigationMode, FirstPersonNavigationMode and PlanViewNavigationMode
 * * Dynamic key mapping
 * * Smart-pivot
 * * Move-to-pointer
 * * Distance-scaled rate of movement
 * * Inertia
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/cameracontrol
 * ````
 *
 * ## Usage
 *
 * Using a {@link CameraControl} to control a {@link @xeokit/viewer!View | View's} {@link @xeokit/viewer!Camera} :
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {CameraControl} from "@xeokit/cameracontrol";
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
 * @module @xeokit/cameracontrol
 */
export * from "./CameraControl";
export * as keycodes from "./keycodes";
