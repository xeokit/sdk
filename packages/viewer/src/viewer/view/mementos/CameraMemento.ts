import type {View} from "../View";
import {Frustum} from "../camera/index";
import {Ortho} from "../camera/index";
import {Perspective} from "../camera/index";

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
 * In the example below, we'll create a {@link Viewer} and use an {@link TreeViewPlugin} to load an ````.xkt```` model. When the model has loaded, we'll save a snapshot of the {@link Camera} state in an CameraMemento. Then we'll move the Camera, and then we'll restore its original state again from the CameraMemento.
 *
 * ````javascript
 * import {Viewer, TreeViewPlugin, CameraMemento} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer({
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
class CameraMemento {
    projection: any;
    up: Float64Array;
    look: Float64Array;
    eye: Float64Array;

    /**
     * Creates a CameraMemento.
     */
    constructor() {
        this.eye = new Float64Array(3);
        this.look = new Float64Array(3);
        this.up = new Float64Array(3);
        this.projection = {};
    }

    /**
     * Saves the state of the given {@link View}'s {@link Camera}.
     *
     * @param view The view that contains the {@link Camera}.
     */
    saveCamera(view: View) {

        const camera = view.camera;
        const project = camera.project;

        this.eye.set(camera.eye);
        this.look.set(camera.look);
        this.up.set(camera.up);

        if (project instanceof Perspective) {
            this.projection = {
                projection: "perspective",
                fov: project.fov,
                fovAxis: project.fovAxis,
                near: project.near,
                far: project.far
            };
        }

        if (project instanceof Ortho) {
            this.projection = {
                projection: "ortho",
                scale: project.scale,
                near: project.near,
                far: project.far
            };
        }

        if (project instanceof Frustum) {
            this.projection = {
                projection: "frustum",
                left: project.left,
                right: project.right,
                top: project.top,
                bottom: project.bottom,
                near: project.near,
                far: project.far
            };
        }

        this.projection = {
            projection: "custom",
            matrix: project.matrix.slice()
        };
    }

    /**
     * Restores a {@link View}'s {@link Camera} to the state previously captured with {@link CameraMemento.saveCamera}.
     *
     * @param view The view.
     * @param {Function} [done] When this callback is given, will fly the {@link Camera} to the saved state then fire the callback. Otherwise will just jump the Camera to the saved state.
     */
    restoreCamera(view: View, done?: Function) {

        const camera = view.camera;
        const savedProjection = this.projection;

        function restoreProjection() {

            switch (savedProjection.type) {

                case "perspective":
                    camera.perspective.fov = savedProjection.fov;
                    camera.perspective.fovAxis = savedProjection.fovAxis;
                    camera.perspective.near = savedProjection.near;
                    camera.perspective.far = savedProjection.far;
                    break;

                case "ortho":
                    camera.ortho.scale = savedProjection.scale;
                    camera.ortho.near = savedProjection.near;
                    camera.ortho.far = savedProjection.far;
                    break;

                case "frustum":
                    camera.frustum.left = savedProjection.left;
                    camera.frustum.right = savedProjection.right;
                    camera.frustum.top = savedProjection.top;
                    camera.frustum.bottom = savedProjection.bottom;
                    camera.frustum.near = savedProjection.near;
                    camera.frustum.far = savedProjection.far;
                    break;

                case "custom":
                    camera.customProjection.matrix = savedProjection.matrix;
                    break;
            }
        }

        if (done) {
            view.cameraFlight.flyTo({
                eye: this.eye,
                look: this.look,
                up: this.up,
                orthoScale: savedProjection.scale,
                projection: savedProjection.projection
            }, () => {
                restoreProjection();
                done();
            });
        } else {
            camera.eye = this.eye;
            camera.look = this.look;
            camera.up = this.up;
            restoreProjection();
            camera.projection = savedProjection.projection;
        }
    }
}

export {CameraMemento};