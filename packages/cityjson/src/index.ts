/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcityjson.svg)](https://badge.fury.io/js/%40xeokit%2Fcityjson)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/cityjson/badge)](https://www.jsdelivr.com/package/npm/@xeokit/cityjson)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="media://images/cityJSONLogo.svg"/>
 *
 * # CityJSON Model Loader
 *
 * * [CityJSON](https://en.wikipedia.org/wiki/Cityjson) is an industry standard format for 3D scenes and models
 * * {@link loadCityJSON} loads CityJSON into a {@link @xeokit/scene!SceneModel | SceneModel} and an optional {@link @xeokit/data!DataModel | DataModel}.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/cityjson
 * ````
 *
 * ## Usage
 *
 * Loading a CityJSON file into a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Data} from "@xeokit/data";
 * import {loadCityJSON} from "@xeokit/cityjson";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const sceneModel = scene.createModel();
 * const dataModel = data.createModel();
 *
 * fetch("myModel.glb").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *          loadCityJSON({ data, sceneModel, dataModel });
 *
 *          sceneModel.build();
 *          dataModel.build();
 *     })
 * });
 * ````
 *
 * Loading a CityJSON file into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {loadCityJSON} from "@xeokit/cityjson";
 *
 * const myViewer = new Viewer({
 *     //...
 * });
 *
 * //...
 *
 * const sceneModel = myViewer.scene.createModel({
 *     id: "sceneModel"
 * });
 *
 * fetch("myModel.glb").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *          loadCityJSON({ data, sceneModel });
 *
 *          sceneModel.build();
 *      });
 * });
 * ````
 *
 * @module @xeokit/cityjson
 */
export * from "./loadCityJSON";