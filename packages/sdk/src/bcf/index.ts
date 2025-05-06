/**
 * <img style="padding:20px; padding-bottom:10px;" src="https://xeokit.github.io/sdk/docs/assets/bcf_logo.png"/>
 *
 * # xeokit BCF Viewpoint Importer and Exporter
 *
 * ---
 *
 * ***Exchange BCF viewpoints with other BIM software to enhance collaboration and communication.***
 *
 * ---
 *
 * The xeokit SDK provides support for interoperability with other BIM software through the exchange of
 * [BCF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#bcf) (Building Collaboration Format) Viewpoints,
 * an open standard that allows exchanging bookmarks of 3D Viewer states.
 *
 * ## Understanding BCF Viewpoints
 * A *BCF viewpoint* captures a snapshot of an issue within a building project. It includes:
 * - **A problem description** to communicate issues to team members.
 * - **The exact location within the 3D model** where the issue occurs.
 *
 * This facilitates efficient collaboration among project stakeholders by allowing them to share and
 * review issues directly within the model.
 *
 * ## Importing and Exporting Viewpoints
 * - **Import a BCF viewpoint** into a {@link viewer!View | View} using {@link loadBCFViewpoint | loadBCFViewpoint}.
 * - **Export the current Viewer state** as a BCF viewpoint using {@link saveBCFViewpoint | saveBCFViewpoint}.
 *
 * For more details on the BCF viewpoint format, see {@link BCFViewpoint | BCFViewpoint}.
 *
 * <br>
 *
 * ![BCF Workflow](https://mermaid.ink/img/pako:eNqlVFFP2zAQ_ivRPUJADe2oZKE-UMRTJlWrxsNmhNz4CkaJbcVOR1f1v2O7SUiyaGJaH1rfd9999-Uu9QEyxREIZDkz5k6w55IVVFLJRYmZFUpG6Tcfh3z0IPAXltGBysh9zqOdiw2Vxz6jTQvenHK2x_JPZurhaISvNq-ufb8gVYzfLu99nVZC2hVzXk1TfXOjfYwWy8Wikdlk25be9dw2dNIVx7R2dwLxrQd2HOQDBx-9t5UM0_KtOwVrtsN_tPwf9syg21_snRZJIaFwcbGgcEbhITQO30M49KJyfAEUJjU7aUQ-QeymqRwOtmGNC5Hou0ETtcMz_onGRz1i7hPEvrnhWBvWuNCouWZDXXq9nNNStSNq_4fb4VPmCktGPHn1AS8D2q3JhUQTaKk7_Xzs5jbCFkyfsrfh3M9nudBayOcnnbNGZVljKw_16UY6sRdlA29dBz09VWglUdpaqg3D-wYxOPMFE9zdNOG5KdgXLJACcUeOW1blloIjOyqrrFrvZQbElhXGUGnOLNZ3E5Aty41DNZNADvAGZBLDHsg0uZwm1_PJbH41mU3nX2ZXxxh-K-UqkhiQC6vKr_Vd53-Cwo-Q922O73wUsH8)
 *
 * <br>
 *
 * ## Installation
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Usage
 *
 * ### Saving and Loading a View as BCF
 *
 * This example demonstrates how to:
 * - Set up a xeokit {@link viewer!Viewer | Viewer}
 * - Load a BIM model from XKT format
 * - Save and load BCF viewpoints to bookmark Viewer states
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { loadXKT } from "@xeokit/sdk/xkt";
 * import { saveBCFViewpoint, loadBCFViewpoint } from "@xeokit/sdk/bcf";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const viewer = new Viewer({
 *      scene,
 *      renderer: new WebGLRenderer()
 * });
 *
 * const view = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas"
 * });
 *
 * const sceneModel = scene.createModel({ id: "myModel" });
 * const dataModel = data.createModel({ id: "myModel" });
 *
 * fetch("myModel.xkt").then(response => response.arrayBuffer().then(fileData => {
 *     loadXKT({ data, sceneModel, dataModel });
 *     sceneModel.build();
 *     dataModel.build();
 * }));
 * ```
 *
 * Once the model is loaded and built, we can capture a viewpoint:
 *
 * ```javascript
 * sceneModel.onBuilt.one(() => {
 *
 *     view.camera.eye = [0, 0, -33];
 *     view.camera.look = [0, 0, 0];
 *     view.camera.up = [0, 0, 1];
 *
 *     view.setObjectsVisible(view.objectIds, false);
 *     view.setObjectsVisible(["myObject1", "myObject2"], true);
 *     view.setObjectsXRayed(["myObject1"], true);
 *
 *     const bcfViewpoint = saveBCFViewpoint({ view });
 * });
 * ```
 *
 * The saved {@link BCFViewpoint | BCFViewpoint} can be restored later:
 *
 * ```javascript
 * loadBCFViewpoint({
 *     bcfViewpoint,
 *     view
 * });
 * ```
 * <br>
 *
 * ### Saving and Loading a ViewLayer as BCF
 *
 * {@link viewer!ViewLayer | ViewLayers} allow selective export of {@link viewer!ViewObject | ViewObjects}. In this example:
 * - **Two ViewLayers** (`foreground` and `background`) are created.
 * - **Only the foreground layer** is exported.
 *
 * ```javascript
 * const foregroundViewLayer = view.createLayer({ id: "foreground" });
 * const backgroundViewLayer = view.createLayer({ id: "background" });
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel",
 *     layerId: "foreground"
 * });
 *
 * sceneModel.build();
 *
 * const bcfViewpoint = saveBCFViewpoint({
 *     view,
 *     includeViewLayerIds: ["foreground"]
 * });
 * ```
 *
 * The viewpoint is restored only for the `foreground` layer:
 *
 * ```javascript
 * loadBCFViewpoint({
 *     bcfViewpoint,
 *     view,
 *     includeViewLayerIds: ["foreground"]
 * });
 * ```
 *
 * @module bcf
 */
export type {BCFOrthogonalCamera} from "./BCFOrthogonalCamera";
export type {BCFPerspectiveCamera} from "./BCFPerspectiveCamera";
export type {BCFVector} from "./BCFVector";
export type {BCFLine} from "./BCFLine";
export type {BCFBitmap} from "./BCFBitmap";
export type {BCFClippingPlane} from "./BCFClippingPlane";
export type {BCFSnapshot} from "./BCFSnapshot";
export type {BCFComponents} from "./BCFComponents";
export type {BCFViewSetupHints} from "./BCFViewSetupHints";
export type {BCFColoringComponent} from "./BCFColoringComponent";
export type {BCFVisibilityComponent} from "./BCFVisibilityComponent";
export type {BCFTranslucencyComponent} from "./BCFTranslucencyComponent";
export type {BCFComponent} from "./BCFComponent";
export type {BCFSelectionComponent} from "./BCFSelectionComponent";
export type {BCFViewpoint} from "./BCFViewpoint";
export {loadBCFViewpoint} from "./loadBCFViewpoint";
export {saveBCFViewpoint} from "./saveBCFViewpoint";
export type {SaveBCFViewpointParams} from "./SaveBCFViewpointParams";
export type {LoadBCFViewpointParams} from "./LoadBCFViewpointParams";

