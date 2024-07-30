/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcityjson.svg)](https://badge.fury.io/js/%40xeokit%2Fcityjson)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/cityjson/badge)](https://www.jsdelivr.com/package/npm/@xeokit/cityjson)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/example_cityJSON.png"/>
 *
 * # xeokit CityJSON Importer
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
 * To import a CityJSON model into xeokit, simply use the {@link @xeokit/cityjson!loadCityJSON} function, which will load
 * the file into both a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}.
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
 * npm install @xeokit/cityjson
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll import a CityJSON file into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and a {@link @xeokit/data!DataModel | DataModel}. The {@link @xeokit/core!SDKError | SDKError} class
 * is used to handle errors that may occur during the process:
 *
 * ````javascript
 * import { Scene } from "@xeokit/scene";
 * import { Data } from "@xeokit/data";
 * import { loadCityJSON } from "@xeokit/cityjson";
 *
 * const scene = new Scene();
 * const data = new Data();
 * const dataModel = data.createModel({ id: "myModel" });
 * const sceneModel = scene.createModel({ id: "myModel" });
 *
 * if (dataModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else if (sceneModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else {
 *      fetch("myModel.json")
 *          .then(response => response.json())
 *          .then(jsonStr => {
 *
 *              const fileData = JSON.parse(jsonStr);
 *
 *              loadCityJSON({
 *                  fileData,
 *                  sceneModel,
 *                  dataModel,
 *                  rotateX: true
 *              }).then(() => {
 *                  sceneModel.build();
 *                  dataModel.build();
 *              }).catch((sdkError)=>{
 *                  console.error(sdkError.message);
 *              });
 * }
 * ````
 *
 * @module @xeokit/cityjson
 */
export * from "./loadCityJSON";
