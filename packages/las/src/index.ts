/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Flas.svg)](https://badge.fury.io/js/%40xeokit%2Flas)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/las/badge)](https://www.jsdelivr.com/package/npm/@xeokit/las)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/autzen.png"/>
 *
 * <br>
 *
 * # LAS/LAZ Point Cloud Importer
 *
 * * [LAS/LAZ](https://github.com/xeokit/sdk/blob/main/GLOSSARY.md#las) is an industry standard format for 3D point cloud scans
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
 * Loading an LAS file into a {@link @xeokit/scene!DataModel | DataModel} and a {@link @xeokit/scene!SceneModel | SceneModel}:
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