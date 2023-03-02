/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Flas.svg)](https://badge.fury.io/js/%40xeokit%2Flas)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/las/badge)](https://www.jsdelivr.com/package/npm/@xeokit/las)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/autzen.png"/>
 *
 * <br>
 *
 * # LAS/LAZ Point Cloud Loader
 *
 * * [LAS/LAZ](https://en.wikipedia.org/wiki/LAS) is an industry standard format for 3D point cloud scans
 * * {@link loadLAS} loads LAS/LAZ into a {@link @xeokit/scene!SceneModel | SceneModel} and an optional {@link @xeokit/data!DataModel | DataModel}
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/las
 * ````
 *
 * ## Usage
 *
 * Loading a LAS file into a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {SceneModel} from "@xeokit/scene";
 * import {loadLAS} from "@xeokit/las";
 *
 * const sceneModel = new SceneModel();
 *
 * fetch("myModel.las").then(response => {
 *     response.arrayBuffer().then(data => {
 *                  
 *         loadLAS({ data, sceneModel });
 *
 *         sceneModel.build();
 *     });
 * });
 * ````
 *
 * Loading a LAS file into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {loadLAS} from "@xeokit/las";
 *
 * const myViewer = new Viewer({
 *     //...
 * });
 *
 * //...
 *
 * const sceneModel= myViewer.scene.createModel({
 *     id: "sceneModel"
 * });
 *
 * fetch("myModel.las").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *         loadLAS({ data, sceneModel });
 *
 *         sceneModel.build();
 *     });
 * });
 * ````
 *
 * @module @xeokit/las
 */
export * from "./loadLAS";