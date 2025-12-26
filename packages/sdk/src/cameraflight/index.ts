/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/example_cityJSON.png"/>
 *
 * # Camera Animation for Views
 *
 * This module provides functionality to animate a {@link viewer!Camera | Camera} to look at specified targets.
 *
 * ## Features:
 * - Controls the Camera within a {@link viewer!View | View}.
 * - Moves the Camera to focus on a {@link viewer!ViewObject | ViewObject} or a specific boundary.
 * - Supports navigation to explicit coordinates using `eye`, `look`, and `up` vectors.
 * - Allows instant (jump) or smooth (fly) transitions.
 * - Enables seamless switching between different projection types.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage Example
 *
 * The following example demonstrates how to:
 * - Set up a {@link viewer!Viewer | Viewer} with a {@link webglrenderer!WebGLRenderer | WebGLRenderer} and a {@link scene!Scene | Scene}.
 * - Attach a {@link cameracontrol!CameraControl | CameraControl} for user interaction.
 * - Load and render a CityJSON model using {@link cityjson!CityJSONLoader | CityJSONLoader}.
 *
 * ```javascript
 * import { SDKInternalException } from "@xeokit/sdk/core";
 * import { Scene } from "@xeokit/sdk/scene";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { CityJSONLoader } from "@xeokit/sdk/cityjson";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const viewer = new Viewer({
 *   scene
 * });
 *
 * const renderer = new WebGLRenderer({
 *   viewer
 * });
 *
 * const viewResult = viewer.createView({
 *   id: "myView",
 *   elementId: "myCanvas" // Ensure this HTMLElement exists on the page
 * });
 *
 * const view = viewResult.value;
 *
 * // Set the initial camera position
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * const dataModel = dataModelResult.value;
 *
 * const cityJSONLoader = new CityJSONLoader();
 *
 * fetch("model.json").then(response => {
 *     response.json().then(fileData => {
 *         cityJSONLoader.load({
 *             fileData,
 *             sceneModel,
 *             dataModel
 *         }).then(() => {
 *             // Loaded
 *         }).catch(err => {
 *             sceneModel.destroy();
 *             dataModel.destroy();
 *             console.error(`Error loading CityJSON: ${err}`);
 *         });
 *     }).catch(err => {
 *         console.error(`Error parsing JSON from fetch response: ${err}`);
 *     });
 * }).catch(err => {
 *     console.error(`Error fetching CityJSON file: ${err}`);
 * });
 * ```
 *
 * @module cameraflight
 */
export * from './CameraFlightAnimation';
