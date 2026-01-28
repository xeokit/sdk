/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/example_cityJSON.png"/>
 *
 * # Mouse and touch controller for a xeokit Viewer's Camera
 *
 * ---
 *
 * ### *Import 3D urban models from CityJSON format*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D urban models from [CityJSON](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#cityjson), a JSON-based
 * file format specifically designed for lightweight, user-friendly, and human-readable
 * storage and sharing of 3D models. CityJSON can represent both basic geometric shapes and intricate objects such as
 * buildings and trees, offering a simple alternative to other formats like CityGML.
 *
 * To import a CityJSON model into xeokit, simply use the {@link cityjson!loadCityJSON | loadCityJSON} function, which will load
 * the file into both a {@link scene!SceneModel | SceneModel} and a {@link data!DataModel | DataModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt?type=png)](https://mermaid.live/edit#pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/cameracontrol
 * ````
 *
 * ## Usage
 *
 * In the example below, we will create a {@link viewer!Viewer | Viewer} with
 * a {@link webglrenderer!WebGLRenderer | WebGLRenderer}  and a {@link scene!Scene | Scene}, which holds model geometry and materials.
 *
 * We'll also create a {@link data!Data | Data}, which will hold semantic data for our model.
 *
 * On our Viewer, we will create a single {@link viewer!View | View} to draw it to a canvas element on the page. We will
 * also attach a {@link cameracontrol!CameraControl | CameraControl} to our View, allowing us to control its camera with mouse and touch input.
 *
 * Within the Scene, we will create a {@link scene!SceneModel | SceneModel} to hold model geometry and materials. Within Data, we will
 * create a {@link data!DataModel | DataModel} to hold semantic IFC data, which includes IFC elements and property sets.
 *
 * We will then use
 * {@link cityjson!loadCityJSON | loadCityJSON} to load a CityJSON file into our SceneModel and DataModel.
 *
 * The {@link core!SDKError | SDKError} class will be used to handle any errors that may occur during this process.
 *
 * * [Run this example]()
 *
 * ````javascript
 * import {SDKError} from "@xeokit/sdk/core";
 * import {Scene} from "@xeokit/sdk/scene";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * import {loadCityJSON} from "@xeokit/sdk/cityjson";
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
 * const cameraControl = new CameraControl(view, {
 *
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
 * fetch("model.json").then(response => {
 *
 *     response.json().then(fileData => {
 *
 *         loadCityJSON({
 *             fileData,
 *             sceneModel,
 *             dataModel
 *         }).then(() => {
 *
 *             sceneModel.build();
 *             dataModel.build();
 *
 *         }).catch(err => {
 *
 *             sceneModel.destroy();
 *             dataModel.destroy();
 *
 *             console.error(`Error loading CityJSON: ${err}`);
 *         });
 *
 *     }).catch(err => {
 *         console.error(`Error creating JSON from fetch response: ${err}`);
 *     });
 *
 * }).catch(err => {
 *     console.error(`Error fetching CityJSON file: ${err}`);
 * });
 * ````
 *
 * @module cameracontrol
 */
export * from "./CameraControl";
//# sourceMappingURL=index.js.map
