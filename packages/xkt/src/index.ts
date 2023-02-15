/**
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * ## Model Loader and Saver for XKT File Format
 *
 * * XKT is xeokit's native compressed sceneModel format, which contains geometry, materials, objects and semantic data in a compact, Web-friendly payload.
 * * {@link loadXKT} loads XKT into a {@link @xeokit/core/components!SceneModel | SceneModel} and an optional {@link @xeokit/datamodel!DataModel | DataModel}.
 * * {@link saveXKT} saves XKT from a {@link @xeokit/core/components!SceneModel | SceneModel} and an optional {@link @xeokit/datamodel!DataModel | DataModel}.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/xkt
 * ````
 *
 * ## Usage
 *
 * Loading an XKT file into a {@link @xeokit/scratchmodel!ScratchModel | ScratchModel}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {loadXKT} from "@xeokit/xkt";
 *
 * const sceneModel = new ScratchModel({
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
 * Loading an XKT file into a {@link @xeokit/core/components!SceneModel | SceneModel} belonging to a {@link @xeokit/viewer!Viewer | Viewer}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {loadXKT} from "@xeokit/xkt";
 *
 * const myViewer = new Viewer({
 *     //...
 * });
 *
 * //...
 *
 * fetch("myModel.xkt").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *         const sceneModel= myViewer.scene.createModel({
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
 * Loading an XKT file into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/core/components!SceneModel | SceneModel} and a {@link @xeokit/datamodel!DataModel | DataModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {DataModel} from "@xeokit/datamodel";
 * import {loadXKT} from "@xeokit/xkt";
 *
 * const myViewer = new Viewer({
 *     //...
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
 *
 *         dataModel.build();
 *     });
 * });
 * ````
 *
 * Saving an XKT file from a {@link @xeokit/scratchmodel!ScratchModel | ScratchModel}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const sceneModel = new ScratchModel();
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
 * Saving an XKT file from a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/core/components!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const myViewer = new Viewer({
 *     //...
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
 * Saving an XKT file from a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/core/components!SceneModel | SceneModel} and a {@link @xeokit/datamodel!DataModel | DataModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {DataModel} from "@xeokit/datamodel";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const myViewer = new Viewer({
 *     //...
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