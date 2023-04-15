/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fbcf.svg)](https://badge.fury.io/js/%40xeokit%2Fbcf)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/bcf/badge)](https://www.jsdelivr.com/package/npm/@xeokit/bcf)
 * 
 * <img style="padding:20px; padding-bottom:10px; " src="media://images/xeokit_bcf_logo.png"/>
 *
 * # xeokit BCF Viewpoint Importer and Exporter
 *
 * ---
 *
 * ### *Interoperate with other BIM software through the exchange of BCF viewpoints*
 *
 * ---
 *
 * The xeokit SDK uses the [BCF](/docs/pages/GLOSSARY.html#bcf) format to exchange bookmarks of Viewer state with other
 * BIM software. BCF (Building Collaboration Format) is an open file format that enables data exchange and collaboration on 3D models and building
 * information. A *BCF viewpoint* is a snapshot of a specific issue related to a building project, containing information such as the
 * problem description, location, and proposed solutions. It is used to facilitate communication and collaboration among
 * project stakeholders in BIM workflows.
 *
 * To import a JSON-encoded BCF viewpoint into a {@link @xeokit/viewer!View | View} belonging to a {@link @xeokit/viewer!Viewer | Viewer}, use the
 * {@link loadBCFViewpoint} function. Similarly, to export the state of a View as a JSON-encoded BCF viewpoint, use
 * the {@link saveBCFViewpoint} function.
 *
 * Refer to {@link BCFViewpoint} for information on the BCF viewpoint format.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqlVFFP2zAQ_ivRPUJADe2oZKE-UMRTJlWrxsNmhNz4CkaJbcVOR1f1v2O7SUiyaGJaH1rfd9999-Uu9QEyxREIZDkz5k6w55IVVFLJRYmZFUpG6Tcfh3z0IPAXltGBysh9zqOdiw2Vxz6jTQvenHK2x_JPZurhaISvNq-ufb8gVYzfLu99nVZC2hVzXk1TfXOjfYwWy8Wikdlk25be9dw2dNIVx7R2dwLxrQd2HOQDBx-9t5UM0_KtOwVrtsN_tPwf9syg21_snRZJIaFwcbGgcEbhITQO30M49KJyfAEUJjU7aUQ-QeymqRwOtmGNC5Hou0ETtcMz_onGRz1i7hPEvrnhWBvWuNCouWZDXXq9nNNStSNq_4fb4VPmCktGPHn1AS8D2q3JhUQTaKk7_Xzs5jbCFkyfsrfh3M9nudBayOcnnbNGZVljKw_16UY6sRdlA29dBz09VWglUdpaqg3D-wYxOPMFE9zdNOG5KdgXLJACcUeOW1blloIjOyqrrFrvZQbElhXGUGnOLNZ3E5Aty41DNZNADvAGZBLDHsg0uZwm1_PJbH41mU3nX2ZXxxh-K-UqkhiQC6vKr_Vd53-Cwo-Q922O73wUsH8?type=png)](https://mermaid.live/edit#pako:eNqlVFFP2zAQ_ivRPUJADe2oZKE-UMRTJlWrxsNmhNz4CkaJbcVOR1f1v2O7SUiyaGJaH1rfd9999-Uu9QEyxREIZDkz5k6w55IVVFLJRYmZFUpG6Tcfh3z0IPAXltGBysh9zqOdiw2Vxz6jTQvenHK2x_JPZurhaISvNq-ufb8gVYzfLu99nVZC2hVzXk1TfXOjfYwWy8Wikdlk25be9dw2dNIVx7R2dwLxrQd2HOQDBx-9t5UM0_KtOwVrtsN_tPwf9syg21_snRZJIaFwcbGgcEbhITQO30M49KJyfAEUJjU7aUQ-QeymqRwOtmGNC5Hou0ETtcMz_onGRz1i7hPEvrnhWBvWuNCouWZDXXq9nNNStSNq_4fb4VPmCktGPHn1AS8D2q3JhUQTaKk7_Xzs5jbCFkyfsrfh3M9nudBayOcnnbNGZVljKw_16UY6sRdlA29dBz09VWglUdpaqg3D-wYxOPMFE9zdNOG5KdgXLJACcUeOW1blloIjOyqrrFrvZQbElhXGUGnOLNZ3E5Aty41DNZNADvAGZBLDHsg0uZwm1_PJbH41mU3nX2ZXxxh-K-UqkhiQC6vKr_Vd53-Cwo-Q922O73wUsH8)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/bcf
 * ````
 *
 * ## Usage
 *
 * ### Saving and Loading a View as BCF
 *
 * In this example we'll set up a xeokit Viewer in a web browser, load a BIM model into it, and then demonstrate how we
 * can save and load bookmarks of our Viewer state as BCF viewpoints, using the model.
 *
 * We'll start with these steps:
 *
 * * create a {@link @xeokit/scene!Scene | Scene} and a {@link @xeokit/data!Data | Data},
 * * initialize a Viewer with the Scene and a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer},
 * * create a new {@link @xeokit/viewer!View | View}, {@link @xeokit/scene!SceneModel | SceneModel} and {@link @xeokit/data!DataModel | DataModel},
 * * load an XKT file using the {@link @xeokit/xkt!loadXKT | loadXKT} function, and
 * * build the Scene and Data models, rendering the 3D model in the web browser.
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Data} from "@xeoki/data";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {loadXKT} from "@xeokit/loadXKT";
 * import {saveBCFViewpoint, loadBCFViewpoint} from "@xeokit/bcf";
 * import * as ifcTypes from "@xeokit/datatypes/ifcTypes";
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
 *     canvasId: "myCanvas"
 * });
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * const dataModel = data.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("myModel.xkt").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *          loadXKT({ data, sceneModel, dataModel });
 *
 *          sceneModel.build();
 *          dataModel.build();
 *     });
 * });
 * ````
 *
 * When our XKT has loaded, that call to {@link @xeokit/scene!SceneModel.build | SceneModel.build} will finalize our SceneModel
 * and cause it to immediately appear in the View's canvas.
 *
 * That call will also trigger {@link @xeokit/scene!SceneModel.onBuilt | SceneModel.onBuilt} and
 * {@link @xeokit/data!DataModel.onBuilt | DataModel.onBuilt} events.
 *
 * On the DataModel.onBuilt event, we'll customize the View by arranging the {@link @xeokit/viewer!Camera} and applying
 * an X-ray effect tp a couple of objects, then we'll use {@link saveBCFViewpoint} to save the state of the View to
 * a BCF viewpoint.
 *
 * Once the SceneModel and DataModel have been built, we can no longer add anything to them.
 *
 * ````javascript
 * dataModel.onBuilt.one(()=>{
 *
 *     view.camera.eye = [0,0,-33];
 *     view.camera.look = [0,0,0];
 *     view.camera.up = [0,0,0];
 *
 *     view.setObjectsVisible(view.objectIds, false);
 *     view.setObjectsVisible(["myObject1", "myObject2", "myObject3", ...], true);
 *
 *     view.setObjectsXRayed(["myObject1", "myObject", ...], true);
 *
 *     const bcfViewpoint = saveBCFViewpoint({
 *         view: view
 *     });
 *
 * });
 * ````
 *
 * Now that we've saved the {@link BCFViewpoint}, we could now use {@link loadBCFViewpoint} to load
 * the {@link BCFViewpoint} back into the {@link @xeokit/viewer!View | View}:
 *
 * ````javascript
 * loadBCFViewpoint({
 *     bcfViewpoint,
 *     view
 * });
 * ````
 *
 * ### Saving and Loading a ViewLayer as BCF
 *
 * As before, let's create a Viewer with a View and a SceneModel.
 *
 * This time, we'll add two {@link @xeokit/viewer!ViewLayer | ViewLayers} to our View, and we'll associate our SceneModel with one of those
 * ViewLayers. ViewLayers allow us to partition our ViewObjects into bins, so that we can conveniently focus certain operations (eg. import/export
 * BCF) only on the relevant ViewObjects.
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Data} from "@xeoki/data";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {loadBCFViewpoint} from "@xeokit/bcf";
 *
 * const viewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderer: new WebGLRenderer({
 *         //...
 *     })
 * });
 *
 * const view = viewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * const foregroundViewLayer = view.createLayer({
 *     id: "foreground"
 * });
 *
 * const backgroundViewLayer = view.createLayer({
 *     id: "background"
 * });
 *
 * const sceneModel = scene.createModel({
 *      id: "myModel",
 *      layerId: "foreground"
 * });
 *
 * //...create some objects, load XKT etc
 *
 * sceneModel.build();
 *
 * const myOtherSceneModel = scene.createModel({
 *      id: "myOtherModel",
 *      layerId: "background"
 * });
 *
 * //...create some objects, load XKT etc
 *
 * myOtherSceneModel.build();
 * ````
 *
 * Now we can use {@link saveBCFViewpoint} to save the states of only the {@link @xeokit/viewer!ViewObject | ViewObjects} in the
 * {@link @xeokit/viewer!ViewLayer | ViewLayer} that contains our SceneModel to a {@link BCFViewpoint}, while ignoring the
 * other ViewLayer:
 *
 * ````javascript
 * const bcfViewpoint = saveBCFViewpoint({
 *      view,
 *      includeViewLayerIds: ["foreground"],
 *      excludeViewLayerIds: ["background"] // Unnecessary, but we'll show it anyway
 * });
 * ````
 *
 * Use {@link loadBCFViewpoint} to load the {@link BCFViewpoint} back into the {@link @xeokit/viewer!ViewLayer | ViewLayer}:
 *
 * ````javascript
 * loadBCFViewpoint({
 *     bcfViewpoint,
 *     view,
 *     includeViewLayerIds: ["foreground"],
 *     excludeViewLayerIds: ["background"]
 * });
 * ````
 *
 * @module @xeokit/bcf
 */
export * from "./loadBCFViewpoint";
export * from "./saveBCFViewpoint";
export * from "./SaveBCFViewpointParams";
export * from "./LoadBCFViewpointParams";
export * from "./BCFViewpoint";