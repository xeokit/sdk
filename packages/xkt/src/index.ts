/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fxkt.svg)](https://badge.fury.io/js/%40xeokit%2Fxkt)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/xkt/badge)](https://www.jsdelivr.com/package/npm/@xeokit/xkt)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) Importer and Exporter
 *
 * ---
 *
 * ### *Import models as xeokit's native binary [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) format*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D models from [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt), which is xeokit's
 * native runtime asset delivery format for model representations and semantics.
 *
 * The [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) format compresses large double-precision model geometry to
 * a compact payload that loads quickly over the Web into a xeokit viewer running in the browser.
 *
 * To import a [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) model into xeokit, use the {@link loadXKT} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * Use the {@link @xeokit/metamodel!loadMetamodel | loadMetamodel} function to load legacy JSON metadata into a {@link @xeokit/data!DataModel | DataModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNkt9vgjAQx_8Vck9bggYYoBLjw-LbNDOyJcvSl0qPyYItaUsyZvzf14LoeJhZX9r79bnrN3eETDCEBLKSKrUs6IekB8IJZ4XETBeCO6uttdu4k2bIcW0qSudIuGNOwbpb7D5NvuqMTCLV-Ny67u47364uStYbDJWWorHmydJ7_pJq2uJv0SspKpS6SfFWv863xZLaX6h9UQ0jmyvlXyN2A64EZW9PLxtqZFK9BvN5ZW3UKBeLzkWlpM1jnecoO4e6KDfglR3vSspr3spuQW3eoCMBj8BotCDgE0h_If_OukhK-LlZHxnUJM6rQuVcPmKUBRcOKA-0YGY_2gEJ6D0ekEBingxzWpeagBnUpNJai7ThGSRa1uhCXTGj8nmjIMlpqYwXWaGFXJ93zl4uVJRDcoQvSEZ-OB0_TKPQ98JJ7EVhFLjQQOKH8TiYemEUB_4sDsPg5MK3EAbrj71g4nlBPAvMiWa2wPDe26Ad5PQDhIPxEQ?type=png)](https://mermaid.live/edit#pako:eNqNkt9vgjAQx_8Vck9bggYYoBLjw-LbNDOyJcvSl0qPyYItaUsyZvzf14LoeJhZX9r79bnrN3eETDCEBLKSKrUs6IekB8IJZ4XETBeCO6uttdu4k2bIcW0qSudIuGNOwbpb7D5NvuqMTCLV-Ny67u47364uStYbDJWWorHmydJ7_pJq2uJv0SspKpS6SfFWv863xZLaX6h9UQ0jmyvlXyN2A64EZW9PLxtqZFK9BvN5ZW3UKBeLzkWlpM1jnecoO4e6KDfglR3vSspr3spuQW3eoCMBj8BotCDgE0h_If_OukhK-LlZHxnUJM6rQuVcPmKUBRcOKA-0YGY_2gEJ6D0ekEBingxzWpeagBnUpNJai7ThGSRa1uhCXTGj8nmjIMlpqYwXWaGFXJ93zl4uVJRDcoQvSEZ-OB0_TKPQ98JJ7EVhFLjQQOKH8TiYemEUB_4sDsPg5MK3EAbrj71g4nlBPAvMiWa2wPDe26Ad5PQDhIPxEQ)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/xkt
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
 * {@link @xeokit/xkt!loadXKT | loadXKT} to load
 * any XKT file into our SceneModel.
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
 * import {loadXKT} from "@xeokit/xkt";
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
 *         fetch("model.xkt").then(response => {
 *
 *             response.arrayBuffer().then(fileData => {
 *
 *                 loadXKT({
 *                     fileData,
 *                     sceneModel
 *                 }).then(() => {
 *
 *                     sceneModel.build();
 *
 *                 }).catch(sdkError => {
 *                     sceneModel.destroy();
 *                     console.error(`Error loading XKT: ${sdkError.message}`);
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
 * @module @xeokit/xkt
 */
export * from "./loadXKT";
export * from "./loadXKTManifest";
