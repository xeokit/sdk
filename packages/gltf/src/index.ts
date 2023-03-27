/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltf.svg)](https://badge.fury.io/js/%40xeokit%2Fgltf)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltf/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltf)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="media://images/xeokit_gltf_logo.svg"/>
 *
 * # xeokit glTF Importer
 *
 * * [glTF](https://en.wikipedia.org/wiki/GlTF) is an industry standard format for 3D scenes and models.
 * * Use {@link loadGLTF} to import glTF into {@link @xeokit/scene!SceneModel | SceneModels} and {@link @xeokit/data!DataModel | DataModels}.
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
 * npm install @xeokit/gltf
 * ````
 *
 * ## Usage
 *
 * Loading a glTF file into a {@link @xeokit/data!DataModel | DataModel} and a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import {Scene} from "@xeokit/scene";
 * import {loadGLTF} from "@xeokit/gltf";
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
 * fetch("myModel.glb").then(response => {
 *
 *     response.arrayBuffer().then(data => {
 *
 *          loadGLTF({ data, dataModel, sceneModel });
 *
 *          dataModel.build();
 *          sceneModel.build();
 *     })
 * });
 * ````
 *
 * @module @xeokit/gltf
 */
export * from "./loadGLTF";