/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; width: 180px;" src="https://xeokit.github.io/sdk/docs/assets/dotbim-logo.png"/>
 *
 * # xeokit .BIM Importer and Exporter
 *
 * ---
 *
 * ***Import and export the open, free, and simple .BIM model file format***
 *
 * ---
 *
 * The xeokit SDK enables the import of 3D models from the [.BIM](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dotbim) format, a JSON-based
 * file format specifically designed for lightweight, user-friendly, and human-readable storage and sharing of 3D BIM models.
 *
 * .BIM is an open-source, minimalist file format for BIM, created to be simple to read and write. It serves as a transfer format that contains triangulated meshes
 * with an associated dictionary of information.
 *
 * To import a .BIM model into xeokit, use the {@link DotBIMLoader} function, which will load the file into both a {@link scene!SceneModel | SceneModel}
 * and a {@link data!DataModel | DataModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUk1vgkAQ_StkTm2CRpDvGA-GSxNNjdyavazsUGmAJbtLUmr8711ApHow5bLMm9n33szOGVLOECJICyplnNNPQUtSkYrlAlOV88rYHrq4zxtJihXu9I3COJPK0F_OhpMfv3S9HIJUIFX43kMvrwN2bPKCjQFDqQRvu_DSsY_8MVW0p3_GXgteo1Btgs_0BuyABe26kKe8vs_sJ5Z_WRwMbjllMVebt92e6knJcQyrVd3FqFCs1wNEhaDtpskyFAMgb8O7KozN3ikUN4WJO2uq_i066r700QaBBYHZbE3AIpD80XlaGE8GJtUx-XgTTChRlDRnelt6ZwTUCUskEOlfhhltCkVAO9SltFE8aasUIiUaNKGpdbd43S-IMlpIjSLLFRe76wZ2hwk1rSA6wzdEtmfNLct3Lc8OlqHnha4JrYbtuRP6nuuElm97wdK9mPDDuWZdzAPbcxzPDh0_cFzHDXu6jz7Z-bj8Aq5V9Qs?type=png)](https://mermaid.live/edit#pako:eNqNUk1vgkAQ_StkTm2CRpDvGA-GSxNNjdyavazsUGmAJbtLUmr8711ApHow5bLMm9n33szOGVLOECJICyplnNNPQUtSkYrlAlOV88rYHrq4zxtJihXu9I3COJPK0F_OhpMfv3S9HIJUIFX43kMvrwN2bPKCjQFDqQRvu_DSsY_8MVW0p3_GXgteo1Btgs_0BuyABe26kKe8vs_sJ5Z_WRwMbjllMVebt92e6knJcQyrVd3FqFCs1wNEhaDtpskyFAMgb8O7KozN3ikUN4WJO2uq_i066r700QaBBYHZbE3AIpD80XlaGE8GJtUx-XgTTChRlDRnelt6ZwTUCUskEOlfhhltCkVAO9SltFE8aasUIiUaNKGpdbd43S-IMlpIjSLLFRe76wZ2hwk1rSA6wzdEtmfNLct3Lc8OlqHnha4JrYbtuRP6nuuElm97wdK9mPDDuWZdzAPbcxzPDh0_cFzHDXu6jz7Z-bj8Aq5V9Qs)
 *
 * <br>
 *
 * ## Installation
 *
 * To install the xeokit SDK, run:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * In the example below, we create a {@link viewer!Viewer | Viewer} with
 * a {@link webglrenderer!WebGLRenderer | WebGLRenderer} and a {@link scene!Scene | Scene}, which holds model geometry and materials.
 *
 * Additionally, we create a {@link data!Data | Data}, which holds the semantic data for our model.
 *
 * We set up a {@link viewer!View | View} to render the model on a canvas element on the page and attach a {@link cameracontrol!CameraControl | CameraControl}
 * to manage the camera using mouse and touch input.
 *
 * The Scene contains a {@link scene!SceneModel | SceneModel} for model geometry and materials, while the Data holds a {@link data!DataModel | DataModel}
 * for IFC elements and property sets.
 *
 * We then use {@link dotbim!DotBIMLoader | DotBIMLoader} to load a .BIM file into the SceneModel and DataModel.
 *
 * The {@link core!SDKError | SDKError} class is used to handle errors during this process.
 *
 * Example:
 *
 * ````javascript
 * import {SDKError} from "@xeokit/sdk/core";
 * import {Scene} from "@xeokit/sdk/scene";
 * import {Data} from "@xeokit/sdk/data";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * import {DotBIMLoader} from "@xeokit/sdk/dotbim";
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
 *     elementId: "myCanvas" // Ensure this HTMLElement exists in the page
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
 *        DotBIMLoader({
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
 * To export the {@link scene!SceneModel | SceneModel} and {@link data!DataModel | DataModel} back to a .BIM file, use {@link dotbim!DotBIMExporter | DotBIMExporter}:
 *
 * ````javascript
 * const dotBIMJSON = XKFWriter.write({
 *     sceneModel,
 *     dataModel
 * });
 * ````
 *
 * @module dotbim
 */
export * from "./DotBIMLoader";
export * from "./DotBIMExporter";
//# sourceMappingURL=index.d.ts.map
