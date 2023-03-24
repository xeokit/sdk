/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fxkt.svg)](https://badge.fury.io/js/%40xeokit%2Fxkt)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/xkt/badge)](https://www.jsdelivr.com/package/npm/@xeokit/xkt)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit XKT Importer and Exporter
 *
 * * [XKT](/docs/pages/GLOSSARY.html#xkt) is xeokit's native compressed model format, which contains geometry, materials, objects and semantic data in a
 * compact, Web-friendly payload.
 * * Use {@link loadXKT} to import XKT files into {@link @xeokit/scene!SceneModel | SceneModels} and {@link @xeokit/data!DataModel | DataModels}.
 * * Use {@link saveXKT} to export {@link @xeokit/scene!SceneModel | SceneModels} and {@link @xeokit/data!DataModel | DataModels} to XKT files.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/xkt
 * ````
 *
 * ## Usage
 *
 * Using {@link loadXKT} to import an XKT file into a {@link @xeokit/data!DataModel | DataModel} and a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import {Scene} from "@xeokit/scene";
 * import {loadXKT, saveXKT} from "@xeokit/xkt";
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
 * fetch("myModel.xkt").then(response => {
 *
 *     response.arrayBuffer().then(data => {
 *
 *          loadXKT({ data, dataModel, sceneModel });
 *
 *          dataModel.build();
 *          sceneModel.build();
 *     })
 * });
 * ````
 *
 * Using {@link saveXKT} to export the {@link @xeokit/data!DataModel | DataModel} and {@link @xeokit/scene!SceneModel | SceneModel} to
 * XKT file data in an ArrayBuffer:
 *
 * ````javascript
 * const arrayBuffer = saveXKT({
 *     dataModel,
 *     sceneModel
 * });
 * ````
 *
 * @module @xeokit/xkt
 */
export * from "./loadXKT";
export * from "./saveXKT";