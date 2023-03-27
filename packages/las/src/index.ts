/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Flas.svg)](https://badge.fury.io/js/%40xeokit%2Flas)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/las/badge)](https://www.jsdelivr.com/package/npm/@xeokit/las)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/autzen.png"/>
 *
 * <br>
 *
 * # xeokit LAS/LAZ Importer
 *
 * * [LAS/LAZ](https://github.com/xeokit/sdk/blob/main/GLOSSARY.md#las) is an industry standard format for 3D point cloud scans.
 * * Use {@link loadLAS} to import LAS/LAZ files into {@link @xeokit/scene!SceneModel | SceneModels} and {@link @xeokit/data!DataModel | DataModels}.
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
 * npm install @xeokit/las
 * ````
 *
 * ## Usage
 *
 * Loading an LAS file into a {@link @xeokit/data!DataModel | DataModel} and a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import {Scene} from "@xeokit/scene";
 * import {loadLAS} from "@xeokit/las";
 *
 * const data = new Data();
 * const scene = new Scene();
 *
 * const dataModel = data.createModel({
 *     id: "myModel
 * });
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel
 * });
 *
 * fetch("myModel.las").then(response => {
 *
 *     response.arrayBuffer().then(data => {
 *
 *          loadLAS({ data, dataModel, sceneModel });
 *
 *          dataModel.build();
 *          sceneModel.build();
 *     })
 * });
 * ````
 *
 * @module @xeokit/las
 */
export * from "./loadLAS";