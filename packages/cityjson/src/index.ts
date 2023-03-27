/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcityjson.svg)](https://badge.fury.io/js/%40xeokit%2Fcityjson)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/cityjson/badge)](https://www.jsdelivr.com/package/npm/@xeokit/cityjson)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/example_cityJSON.png"/>
 *
 * # xeokit CityJSON Importer
 *
 * * [CityJSON](/docs/pages/GLOSSARY.html#cityjson) is an industry standard format for 3D scenes and models.
 * * Use {@link loadCityJSON} to import CityJSON into {@link @xeokit/scene!SceneModel | SceneModels} and {@link @xeokit/data!DataModel | DataModels}.
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
 * Import a CityJSON file into a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Data} from "@xeokit/data";
 * import {loadCityJSON} from "@xeokit/cityjson";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const dataModel = data.createModel({
 *     id: "myModel"
 * });
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("myModel.json")
 *      .then(function (response) {
 *          return response.json();
 *      })
 *      .then(function (data) {
 *          const fileData = JSON.parse(data);
 *
 *          loadCityJSON({
 *              data: fileData,
 *              sceneModel,
 *              dataModel
 *          }, {
 *              rotateX: true
 *          }).then(() => {
 *
 *         sceneModel.build();
 *         dataModel.build();
 *    });
 * ````
 *
 *
 * @module @xeokit/cityjson
 */
export * from "./loadCityJSON";