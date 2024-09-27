/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdotbim.svg)](https://badge.fury.io/js/%40xeokit%2Fdotbim)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/dotbim/badge)](https://www.jsdelivr.com/package/npm/@xeokit/dotbim)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; width: 180px;" src="media://images/dotbim-logo.png"/>
 *
 * # xeokit .BIM Importer and Exporter
 *
 * ---
 *
 * ### *Import and export the open, free and simple .BIM model file format*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D models from [.BIM](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dotbim), a JSON-based
 * file format specifically designed for lightweight, user-friendly, and human-readable storage and sharing of 3D BIM models.
 *
 * .BIM is an open-source and minimalist file format for BIM that's built to be easy to read and write. Essentially, .BIM
 * is a transfer format that contains triangulated meshes with a dictionary of information attached to them.
 *
 * To import a .BIM model into xeokit, simply use the {@link loadDotBIM} function, which will load the file into both
 * a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUk1vgkAQ_StkTm2CRpDvGA-GSxNNjdyavazsUGmAJbtLUmr8711ApHow5bLMm9n33szOGVLOECJICyplnNNPQUtSkYrlAlOV88rYHrq4zxtJihXu9I3COJPK0F_OhpMfv3S9HIJUIFX43kMvrwN2bPKCjQFDqQRvu_DSsY_8MVW0p3_GXgteo1Btgs_0BuyABe26kKe8vs_sJ5Z_WRwMbjllMVebt92e6knJcQyrVd3FqFCs1wNEhaDtpskyFAMgb8O7KozN3ikUN4WJO2uq_i066r700QaBBYHZbE3AIpD80XlaGE8GJtUx-XgTTChRlDRnelt6ZwTUCUskEOlfhhltCkVAO9SltFE8aasUIiUaNKGpdbd43S-IMlpIjSLLFRe76wZ2hwk1rSA6wzdEtmfNLct3Lc8OlqHnha4JrYbtuRP6nuuElm97wdK9mPDDuWZdzAPbcxzPDh0_cFzHDXu6jz7Z-bj8Aq5V9Qs?type=png)](https://mermaid.live/edit#pako:eNqNUk1vgkAQ_StkTm2CRpDvGA-GSxNNjdyavazsUGmAJbtLUmr8711ApHow5bLMm9n33szOGVLOECJICyplnNNPQUtSkYrlAlOV88rYHrq4zxtJihXu9I3COJPK0F_OhpMfv3S9HIJUIFX43kMvrwN2bPKCjQFDqQRvu_DSsY_8MVW0p3_GXgteo1Btgs_0BuyABe26kKe8vs_sJ5Z_WRwMbjllMVebt92e6knJcQyrVd3FqFCs1wNEhaDtpskyFAMgb8O7KozN3ikUN4WJO2uq_i066r700QaBBYHZbE3AIpD80XlaGE8GJtUx-XgTTChRlDRnelt6ZwTUCUskEOlfhhltCkVAO9SltFE8aasUIiUaNKGpdbd43S-IMlpIjSLLFRe76wZ2hwk1rSA6wzdEtmfNLct3Lc8OlqHnha4JrYbtuRP6nuuElm97wdK9mPDDuWZdzAPbcxzPDh0_cFzHDXu6jz7Z-bj8Aq5V9Qs)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/dotbim
 * ````
 *
 * ## Usage
 *
 * In the example below, we will create a {@link @xeokit/viewer!Viewer | Viewer} with
 * a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer}  and a {@link @xeokit/scene!Scene | Scene}, which holds model geometry and materials.
 *
 * We'll also create a {@link @xeokit/data!Data | Data}, which will hold semantic data for our model.
 *
 * On our Viewer, we will create a single {@link @xeokit/viewer!View | View} to render it to a canvas element on the page. We will
 * also attach a {@link @xeokit/cameracontrol!CameraControl | CameraControl} to our View, allowing us to control its camera with mouse and touch input.
 *
 * Within the Scene, we will create a {@link @xeokit/scene!SceneModel | SceneModel} to hold model geometry and materials. Within Data, we will
 * create a {@link @xeokit/data!DataModel | DataModel} to hold semantic IFC data, which includes IFC elements and property sets.
 *
 * We will then use
 * {@link @xeokit/dotbim!loadDotBIM | loadDotBIM} to load a .BIM file into our SceneModel and DataModel.
 *
 * The {@link @xeokit/core!SDKError | SDKError} class will be used to handle any errors that may occur during this process.
 *
 * * [Run this example]()
 *
 * ````javascript
 * import {SDKError} from "@xeokit/core";
 * import {Scene} from "@xeokit/scene";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {Viewer} from "@xeokit/viewer";
 * import {CameraControl} from "@xeokit/cameracontrol";
 * import {loadDotBIM} from "@xeokit/dotbim";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const renderer = new WebGLRenderer({});
 *
 * const viewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderer
 * });
 *
 * const view = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas" // << Ensure that this HTMLElement exists in the page
 * });
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * const dataModel = data.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("model.bim").then(response => {
 *
 *    response.json().then(fileData => {
 *
 *        loadDotBIM({
 *           fileData,
 *           sceneModel,
 *           dataModel
 *        }).then(() => {
 *
 *           sceneModel.build();
 *           dataModel.build();
 *
 *        }).catch(err => {
 *
 *           sceneModel.destroy();
 *           dataModel.destroy();
 *
 *           console.error(`Error loading .BIM: ${err}`);
 *        });
 *
 *    }).catch(err => {
 *        console.error(`Error creating JSON from fetch response: ${err}`);
 *    });
 *
 * }).catch(err => {
 *     console.error(`Error fetching .BIM file: ${err}`);
 * });
 *
 * ````
 *
 * Using {@link @xeokit/dotbim!saveDotBIM | saveDotBIM} to export the {@link @xeokit/scene!SceneModel | SceneModel} and
 * {@link @xeokit/data!DataModel | DataModel} back to a .BIM file:
 *
 * ````javascript
 * const dotBIMJSON = saveXGF({
 *     sceneModel,
 *     dataModel
 * });
 * ````
 *
 * @module @xeokit/dotbim
 */
export * from "./loadDotBIM";
export * from "./saveDotBIM";
