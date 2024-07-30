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
 * ---
 *
 * ### *Import 3D lidar point cloud datasets*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D models from [LAS](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#las), a
 * file format for the interchange of 3-dimensional point cloud data.
 *
 * The LAS file format is a standardized binary format used for storing and sharing 3D point cloud data from LiDAR
 * scanners. It includes header information and point data attributes, supports compressed and uncompressed data, and
 * is widely used in surveying, mapping, and other industries.
 *
 * To import an LAS model into xeokit, use the {@link loadLAS} function, which will load the file into
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
 * npm install @xeokit/las
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll import an LAS file into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and a {@link @xeokit/data!DataModel | DataModel}. The {@link @xeokit/core!SDKError | SDKError} class
 * is used to handle errors that may occur during the process:
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
 *      response.arrayBuffer().then(fileData => {
 *
 *          loadLAS({
 *              fileData,           // Load LAS/LAZ from this ArrayBuffer
 *              dataModel,          // Save metadata in this DataModel (optional)
 *              sceneModel,         // Load points into this SceneModel
 *              fp64: false,        // Expect points as 64-bit floats? (optional, default is true)
 *              colorDepth: "auto", // 8, 16 or "auto" (optional, default is "auto)
 *              skip: 1,            // Load every nth point (optional, default is 1)
 *              center: false,      // Whether to center the points (optional)
 *              transform: [        // Transform the points (optional)
 *                  1,0,0,0,
 *                  0,1,0,0,
 *                  0,0,1,0,
 *                  0,0,0,1
 *              ],
 *              log: (msg) => {     // Log loading progress (optional)
 *                  console.log(msg);
 *              }
 *          }).then(()=>{
 *              dataModel.build();
 *              sceneModel.build();
 *          });
 *      });
 * });
 * ````
 *
 * @module @xeokit/las
 */
export * from "./loadLAS";
