/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fxkt.svg)](https://badge.fury.io/js/%40xeokit%2Fxkt)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/xkt/badge)](https://www.jsdelivr.com/package/npm/@xeokit/xkt)
 * 
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # XKT Model Loader and Saver
 *
 * * [XKT](/docs/pages/GLOSSARY.html#xkt) is xeokit's native compressed sceneModel format, which contains geometry, materials, objects and semantic data in a
 * compact, Web-friendly payload.
 * * {@link loadXKT} loads XKT into a {@link @xeokit/scene!SceneModel | SceneModel} and an
 * optional {@link @xeokit/data!DataModel | DataModel}.
 * * {@link saveXKT} saves XKT from a {@link @xeokit/scene!SceneModel | SceneModel} and
 * an optional {@link @xeokit/data!DataModel | DataModel}.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/xkt
 * ````
 *
 * ## Usage
 *
 * Loading an XKT file into a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {loadXKT} from "@xeokit/xkt";
 *
 * const scene = new Scene();
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("myModel.xkt").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *          loadXKT({ data, sceneModel });
 *
 *          sceneModel.build();
 *    });
 * });
 * ````
 *
 * Loading an XKT file into a {@link @xeokit/scene!SceneModel | SceneModel} belonging to a {@link @xeokit/viewer!Viewer | Viewer}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {loadXKT} from "@xeokit/xkt";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene: new Scene(),
 *     //...
 * });
 *
 * //...
 *
 * fetch("myModel.xkt").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *         const sceneModel = myViewer.scene.createModel({
 *             id: "myModel"
 *         });
 *
 *         loadXKT({ data, sceneModel });
 *
 *         sceneModel.build();
 *     });
 * });
 * ````
 *
 * Loading an XKT file into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {DataModel} from "@xeokit/data";
 * import {loadXKT} from "@xeokit/xkt";
 *
 * const myViewer = new Viewer({
 *     //...
 *     scene: new Scene()
 * });
 *
 * //...
 *
 * const sceneModel = myViewer.scene.createModel({
 *     id: "myModel"
 * });
 *
 * const data = new Data();
 *
 * const dataModel = data.createModel({
 *      id: "myModel"
 * });
 *
 * fetch("myModel.xkt").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *         loadXKT({
 *             data,
 *             sceneModel,
 *             dataModel
 *         });
 *
 *         sceneModel.build();
 *         dataModel.build();
 *     });
 * });
 * ````
 *
 * Saving an XKT file from a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {SceneModel} from "@xeokit/scene";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const data = new Data();
 *
 * const sceneModel = data.createModel();
 *
 * //...
 *
 * await sceneModel.build();
 *
 * const arrayBuffer = saveXKT({
 *     sceneModel
 * });
 * ````
 *
 * Saving an XKT file from a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const myViewer = new Viewer({
 *     //...,
 *     scene: new Scene()
 * });
 *
 * //...
 *
 * const sceneModel = myViewer.scene.createModel({
 *     id: "myModel"
 * });
 *
 * //...
 *
 * await sceneModel.build();
 *
 * const arrayBuffer = saveXKT({
 *     sceneModel
 * });
 * ````
 *
 * Saving an XKT file from a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {DataModel} from "@xeokit/data";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const myViewer = new Viewer({
 *     //...,
 *     scene: new Scene()
 * });
 *
 * //...initialize viewer
 *
 * const sceneModel = myViewer.scene.createModel({
 *     id: "myModel"
 * });
 *
 * //...build the scene model...
 *
 * const data = new Data();
 *
 * const dataModel = data.createModel({
 *      id: "myModel"
 * });
 *
 * //...build data model...
 *
 * await sceneModel.build();
 * dataModel.build();
 *
 * const arrayBuffer = saveXKT({
 *     sceneModel,
 *     dataModel
 * });
 * ````
 *
 * @module @xeokit/xkt
 */
export * from "./loadXKT";
export * from "./saveXKT";