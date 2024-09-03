/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdtx.svg)](https://badge.fury.io/js/%40xeokit%2Fdtx)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/dtx/badge)](https://www.jsdelivr.com/package/npm/@xeokit/dtx)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) Format Importer and Exporter
 *
 * ---
 *
 * ### *Import and export SceneModels as xeokit's native binary [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) format*
 *
 * ---
 *
 * This package allows us to import and export xeokit {@link @xeokit/scene!SceneModel | SceneModels} as [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx), a
 * compact binary-encoded runtime asset delivery format for geometry and materials.
 *
 * To import a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) model into xeokit, use the {@link loadDTX} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel}. To export a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) model, use the {@link saveDTX} function, which will save a
 * {@link @xeokit/scene!SceneModel | SceneModel} to [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx).
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNkk1PwzAMhv9K5RNI3dSPtemqaafd2ASiICGUS9a4ENQ2U5MixrT_Tvo1WiEQvaSvHT9-rfgEqeQIMaQ5U2oj2EvFClrSkosKUy1kaW3vG93mrSTFEnemIrdOtLTMJ3h3yv2bua86kVbINN62oavrLravRc4HwVHpSh4beW7oA38rGX-6ebhjxoUaWqxWh0ajxmq97kKZyHHDNOuUurjqcR0s72DfmKwu25Eayuhewt7xP03HbSYA1QH-aDSZi4JDYTZbU3ApJCNob3hITYpi61Ghsi6mVIOdOP8V29u7pMZFP7BgQ4FVwQQ3S9EOREG_YoEUYvPLMWN1rimYwcxVVmuZHMsUYl3VaEN94Obh-zWCOGO5MlHkQstq1y9ac9hwYCXEJ_iA2HP8eRiFAXHDZUA8J7DhCPHCieYRWRDPJ15EiB-cbfiU0kCdeeD4hLjL0DFh33Nb2HOba1ycvwAqVO7G?type=png)](https://mermaid.live/edit#pako:eNqNkk1PwzAMhv9K5RNI3dSPtemqaafd2ASiICGUS9a4ENQ2U5MixrT_Tvo1WiEQvaSvHT9-rfgEqeQIMaQ5U2oj2EvFClrSkosKUy1kaW3vG93mrSTFEnemIrdOtLTMJ3h3yv2bua86kVbINN62oavrLravRc4HwVHpSh4beW7oA38rGX-6ebhjxoUaWqxWh0ajxmq97kKZyHHDNOuUurjqcR0s72DfmKwu25Eayuhewt7xP03HbSYA1QH-aDSZi4JDYTZbU3ApJCNob3hITYpi61Ghsi6mVIOdOP8V29u7pMZFP7BgQ4FVwQQ3S9EOREG_YoEUYvPLMWN1rimYwcxVVmuZHMsUYl3VaEN94Obh-zWCOGO5MlHkQstq1y9ac9hwYCXEJ_iA2HP8eRiFAXHDZUA8J7DhCPHCieYRWRDPJ15EiB-cbfiU0kCdeeD4hLjL0DFh33Nb2HOba1ycvwAqVO7G)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/dtx
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
 * {@link @xeokit/dtx!loadDTX | loadDTX} to load
 * a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file into our SceneModel.
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
 * import {loadDTX, saveDTX} from "@xeokit/dtx";
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
 * fetch("model.dtx").then(response => {
 *
 *     response.arrayBuffer().then(fileData => {
 *
 *         loadDTX({
 *             fileData,
 *             sceneModel
 *         }).then(() => {
 *
 *             sceneModel.build();
 *
 *         }).catch(err => {
 *
 *             sceneModel.destroy();
 *
 *             console.error(`Error loading DTX: ${err}`);
 *         });
 *
 *     }).catch(err => {
 *         console.error(`Error creating ArrayBuffer from fetch response: ${err}`);
 *     });
 *
 * }).catch(err => {
 *     console.error(`Error fetching DTX file: ${err}`);
 * });
 * ````
 *
 * Using {@link @xeokit/dtx!saveDTX | saveDTX} to export the {@link @xeokit/scene!SceneModel | SceneModel} back to
 * [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx):
 *
 * ````javascript
 * const arrayBuffer = saveDTX({
 *     sceneModel
 * });
 * ````
 *
 * @module @xeokit/dtx
 */
export * from "./loadDTX";
export * from "./saveDTX";
export * from "./versions/v1/DTXData_v1";
