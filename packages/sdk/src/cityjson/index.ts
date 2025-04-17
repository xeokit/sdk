/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/example_cityJSON.png"/>
 *
 * # xeokit CityJSON Importer
 *
 * ---
 *
 * **Import and visualize 3D urban models from the CityJSON format**
 *
 * ---
 *
 * The xeokit SDK provides support for importing 3D urban models from [CityJSON](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#cityjson),
 * a lightweight, user-friendly, and human-readable JSON-based file format designed for storing and sharing 3D city models.
 * CityJSON simplifies the representation of urban objects such as buildings and trees, offering a more accessible alternative to formats like CityGML.
 *
 * To load a CityJSON model into xeokit, use the {@link cityjson!loadCityJSON | loadCityJSON} function.
 * This function populates both a {@link scene!SceneModel | SceneModel} for geometry and materials and a {@link data!DataModel | DataModel} for semantic data.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt?type=png)](https://mermaid.live/edit#pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt)
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * The following example demonstrates how to:
 * - Set up a {@link viewer!Viewer | Viewer} with a {@link webglrenderer!WebGLRenderer | WebGLRenderer} and a {@link scene!Scene | Scene}.
 * - Attach a {@link cameracontrol!CameraControl | CameraControl} for interactive navigation.
 * - Load and render a CityJSON model using {@link cityjson!loadCityJSON | loadCityJSON}.
 * - Handle potential errors using {@link core!SDKError | SDKError}.
 *
 * ```javascript
 * import { SDKError } from "@xeokit/sdk/core";
 * import { Scene } from "@xeokit/sdk/scene";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { CityJSONLoader } from "@xeokit/sdk/cityjson";
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
 * // Set the initial camera position
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModel = scene.createModel({ id: "myModel" });
 * const dataModel = data.createModel({ id: "myModel" });
 *
 * fetch("model.json").then(response => {
 *     response.json().then(fileData => {
 *         (new CityJSONLoader()).load({
 *             fileData,
 *             sceneModel,
 *             dataModel
 *         }).then(() => {
 *             sceneModel.build();
 *             dataModel.build();
 *         }).catch(err => {
 *             sceneModel.destroy();
 *             dataModel.destroy();
 *             console.error(`Error loading CityJSON: ${err}`);
 *         });
 *     }).catch(err => {
 *         console.error(`Error parsing JSON from fetch response: ${err}`);
 *     });
 * }).catch(err => {
 *     console.error(`Error fetching CityJSON file: ${err}`);
 * });
 * ```
 *
 * @module cityjson
 */
export * from "./CityJSONLoader";
