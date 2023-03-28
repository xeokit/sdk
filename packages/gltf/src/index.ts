/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltf.svg)](https://badge.fury.io/js/%40xeokit%2Fgltf)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltf/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltf)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="media://images/xeokit_gltf_logo.svg"/>
 *
 * # xeokit glTF Importer
 *
 * The xeokit SDK allows us to import 3D models from [glTF](/docs/pages/GLOSSARY.html#gltf) (GL Transmission Format), a
 * file format that is a runtime asset delivery format for 3D scenes and models.
 *
 * glTF is a compact and efficient format for 3D content, allowing fast loading and rendering in apps and web
 * browsers. It stores geometry, materials, textures, animations, and scene hierarchy, and is open and royalty-free,
 * making it a popular choice for 3D content distribution and exchange.
 *
 * To import a glTF model into xeokit, use the {@link loadGLTF} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}.
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
 * In the example below, we'll import a glTF file into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and a {@link @xeokit/data!DataModel | DataModel}. The {@link @xeokit/core/components!SDKError} class
 * is used to handle errors that may occur during the process:
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
 * if (dataModel instanceof SDKError) {
 *      console.error(dataModel.message);
 *
 * } else if (sceneModel instanceof SDKError) {
 *      console.error(dataModel.message);
 *
 * } else {
 *      fetch("myModel.glb").then(response => {
 *          response.arrayBuffer().then(data => {
 *
 *              loadGLTF({ data, dataModel, sceneModel });
 *
 *                  dataModel.build();
 *                  sceneModel.build();
 *              });
 *         });
 *     }
 * ````
 *
 * @module @xeokit/gltf
 */
export * from "./loadGLTF";