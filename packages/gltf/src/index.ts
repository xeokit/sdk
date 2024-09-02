/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltf.svg)](https://badge.fury.io/js/%40xeokit%2Fgltf)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltf/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltf)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="media://images/xeokit_gltf_logo.svg"/>
 *
 * # xeokit glTF Importer
 *
 * ---
 *
 * ### *Import models from the industry standard glTF model file format*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D models from [glTF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#gltf) (GL Transmission Format), a
 * file format that is a runtime asset delivery format for 3D scenes and models.
 *
 * glTF is a compact and efficient format for 3D content, allowing fast loading and rendering in apps and web
 * browsers. It stores geometry, materials, textures, animations, and scene hierarchy, and is open and royalty-free,
 * making it a popular choice for 3D content distribution and exchange.
 *
 * To import a glTF model into xeokit, use the {@link loadGLTF} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNpVkctOwzAQRX8lmhVIaZVHE6dRlVUFm1Ygygp548YTMErsynYkStV_x84DqDf2vTM-Mx5foFYcoYS6ZcZsBXvXrKOSSi401lYoGexevB7iwaFGiXt3ow0uVAZuCT7u6vjp8s0oao3M4tNg3d2P3rEXLZ8FR2O1Ont59fSZv1OMP-5eH56Za8PMNTabk9doUVfVaDWixS2zbFTmt62JN9LaifbHaXo5PMpjhsTbghQiCotFRSGmcPgHnUlz7PYahNCh7pjgbpBDLQr2AzukULojx4b1raXgarpU1lt1OMsaSqt7DKE_cTesafRQNqw1zkUurNL76XP8FsKJSSgv8AVlEqXLvMgzEufrjCRRFsIZylVULAuyIklKkoKQNLuG8K2Ug0bLLEoJidd55Ow0iQfY2xDzXVx_ANo5py0?type=png)](https://mermaid.live/edit#pako:eNpVkctOwzAQRX8lmhVIaZVHE6dRlVUFm1Ygygp548YTMErsynYkStV_x84DqDf2vTM-Mx5foFYcoYS6ZcZsBXvXrKOSSi401lYoGexevB7iwaFGiXt3ow0uVAZuCT7u6vjp8s0oao3M4tNg3d2P3rEXLZ8FR2O1Ont59fSZv1OMP-5eH56Za8PMNTabk9doUVfVaDWixS2zbFTmt62JN9LaifbHaXo5PMpjhsTbghQiCotFRSGmcPgHnUlz7PYahNCh7pjgbpBDLQr2AzukULojx4b1raXgarpU1lt1OMsaSqt7DKE_cTesafRQNqw1zkUurNL76XP8FsKJSSgv8AVlEqXLvMgzEufrjCRRFsIZylVULAuyIklKkoKQNLuG8K2Ug0bLLEoJidd55Ow0iQfY2xDzXVx_ANo5py0)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/gltf
 * ````
 *
 * ## Usage
 *
 * In the example below, we will create a {@link @xeokit/viewer!Viewer | Viewer} with
 * a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer}  and a {@link @xeokit/scene!Scene | Scene}, which holds model geometry and materials.
 *
 * On our Viewer, we will create a single {@link @xeokit/viewer!View | View} to render it to a canvas element on the page. We will
 * also attach a {@link @xeokit/cameracontrol!CameraControl | CameraControl} to our View, allowing us to control its camera with mouse and touch input.
 *
 * Within the Scene, we will create a {@link @xeokit/scene!SceneModel | SceneModel} to hold a model. We will then use
 * {@link @xeokit/gltf!loadGLTF | loadGLTF} to load
 * a binary glTF (GLB) file into our SceneModel.
 *
 * The {@link @xeokit/core!SDKError | SDKError} class will be used to handle any errors that may occur during this process.
 *
 * * [Run this example]()
 *
 * ````javascript
 * import {SDKError} from "@xeokit/core";
 * import {Scene} from "@xeokit/scene";
 * import  {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {Viewer} from "@xeokit/viewer";
 * import {CameraControl} from "@xeokit/cameracontrol";
 * import {loadGLTF} from "@xeokit/gltf";
 *
 * const scene = new Scene();
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
 * if (view instanceof SDKError) {
 *     console.error(`Error creating View: ${view.message}`);
 *
 * } else {
 *
 *     view.camera.eye = [1841982.93, 10.03, -5173286.74];
 *     view.camera.look = [1842009.49, 9.68, -5173295.85];
 *     view.camera.up = [0.0, 1.0, 0.0];
 *
 *     new CameraControl(view, {});
 *
 *     const sceneModel = scene.createModel({
 *         id: "myModel"
 *     });
 *
 *     if (sceneModel instanceof SDKError) {
 *         console.error(`Error creating SceneModel: ${sceneModel.message}`);
 *
 *     } else {
 *
 *         fetch("model.glb").then(response => {
 *
 *             response.arrayBuffer().then(fileData => {
 *
 *                 loadGLTF({
 *                     fileData,
 *                     sceneModel
 *                 }).then(() => {
 *
 *                     sceneModel.build();
 *
 *                 }).catch(sdkError => {
 *                     sceneModel.destroy();
 *                     console.error(`Error loading glTF: ${sdkError.message}`);
 *                 });
 *
 *             }).catch(message => {
 *                 console.error(`Error creating ArrayBuffer: ${message}`);
 *             });
 *
 *         }).catch(message => {
 *             console.error(`Error fetching model: ${message}`);
 *         });
 *     }
 * }
 * ````
 *
 * @module @xeokit/gltf
 */
export * from "./loadGLTF";
export * from "./loadGLTFManifest";
