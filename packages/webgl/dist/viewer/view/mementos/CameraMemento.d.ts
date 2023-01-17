import type { View } from "../View";
/**
 * Saves and restores the state of a {@link View}'s {@link Camera}.
 *
 * ## See Also
 *
 * * {@link ModelMemento} - Saves and restores a snapshot of the visual state of the {@link Entity}'s of a model within a {@link Scene}.
 * * {@link ViewObjectsMemento} - Saves and restores a snapshot of the visual state of the {@link Entity}'s that represent objects within a {@link Scene}.
 *
 * ## Usage
 *
 * In the example below, we'll create a {@link WebViewer} and use an {@link TreeViewPlugin} to load an ````.xkt```` model. When the model has loaded, we'll save a snapshot of the {@link Camera} state in an CameraMemento. Then we'll move the Camera, and then we'll restore its original state again from the CameraMemento.
 *
 * ````javascript
 * import {WebViewer, TreeViewPlugin, CameraMemento} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer({
 *     canvasId: "myCanvas"
 * });
 *
 * // Load a model
 * const xktLoader = new TreeViewPlugin(viewer);
 *
 * const model = xktLoader.load({
 *     id: "myModel",
 *     src: "./models/xkt/schependomlaan/schependomlaan.xkt"
 * });
 *
 * // Set camera
 * viewer.camera.eye = [-2.56, 8.38, 8.27];
 * viewer.camera.look = [13.44, 3.31, -14.83];
 * viewer.camera.up = [0.10, 0.98, -0.14];
 *
 * model.on("loaded", () => {
 *
 *      // Model has loaded
 *
 *      // Save memento of camera state
 *      const cameraMemento = new CameraMemento();
 *
 *      cameraMemento.saveCamera(viewer.scene);
 *
 *      // Move the camera
 *      viewer.camera.eye = [45.3, 2.00, 5.13];
 *      viewer.camera.look = [0.0, 5.5, 10.0];
 *      viewer.camera.up = [0.10, 0.98, -0.14];
 *
 *      // Restore the camera state again
 *      objectsMemento.restoreCamera(viewer.scene);
 * });
 * ````
 */
declare class CameraMemento {
    projection: any;
    up: Float64Array;
    look: Float64Array;
    eye: Float64Array;
    /**
     * Creates a CameraMemento.
     */
    constructor();
    /**
     * Saves the state of the given {@link View}'s {@link Camera}.
     *
     * @param view The view that contains the {@link Camera}.
     */
    saveCamera(view: View): void;
    /**
     * Restores a {@link View}'s {@link Camera} to the state previously captured with {@link CameraMemento.saveCamera}.
     *
     * @param view The view.
     * @param {Function} [done] When this callback is given, will fly the {@link Camera} to the saved state then fire the callback. Otherwise will just jump the Camera to the saved state.
     */
    restoreCamera(view: View, done?: Function): void;
}
export { CameraMemento };
