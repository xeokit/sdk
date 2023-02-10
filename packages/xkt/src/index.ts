/**
 * <img src="https://miro.medium.com/max/673/1*YUHvwJvfTLWyqiqCYw2ToA.png"/>
 *
 * ## Model Loader and Saver for XKT File Format
 *
 * * XKT is xeokit's native compressed model format
 * * {@link loadXKT|loadXKT} loads XKT into a {@link @xeokit/core/components!BuildableModel}, which is implemented by {@link @xeokit/datamodel!DocModel | DocModel} and {@link @xeokit/viewer!ViewerModel | ViewerModel}
 * * {@link saveXKT|saveXKT} saves XKT from a {@link @xeokit/core/components!Model}, which is implemented by {@link @xeokit/datamodel!DocModel | DocModel} and {@link @xeokit/viewer!ViewerModel | ViewerModel}
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/xkt
 * ````
 *
 * ## Usage
 *
 * Loading an XKT file into a {@link @xeokit/docmodel!DocModel | DocModel}:
 *
 * ````javascript
 * import {DocModel} from "@xeokit/docmodel";
 * import {loadXKT} from "@xeokit/xkt";
 *
 * const myDocModel = new DocModel();
 *
 * fetch("myModel.xkt")
 *     .then(response => {
 *          if (response.ok) {
 *              loadXKT({
 *                  xkt: response.arrayBuffer(),
 *                  model: myDocModel
 *              });
 *              myDocModel.built();
 *          }
 *     });
 * ````
 *
 * Loading an XKT file into a {@link @xeokit/viewer!ViewerModel | ViewerModel}:
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
 * const myViewerModel= myViewer.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("myModel.xkt")
 *     .then(response => {
 *          if (response.ok) {
 *              loadXKT({
 *                  xkt: response.arrayBuffer(),
 *                  model: myViewerModel
 *              });
 *              myViewerModel.build();
 *          }
 *     });
 * ````
 *
 * Loading an XKT file into a {@link @xeokit/viewer!ViewerModel | ViewerModel} and a {@link @xeokit/datamodel/DataModel}:
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
 * const myViewerModel= myViewer.createModel({
 *     id: "myModel"
 * });
 *
 * const data = new Data();
 *
 * const myDataModel = data.createModel({
 *      id: "myModel"
 * });
 *
 * fetch("myModel.xkt")
 *     .then(response => {
 *          if (response.ok) {
 *
 *              loadXKT({
 *                  xkt: response.arrayBuffer(),
 *                  model: myViewerModel,
 *                  dataModel: myDataModel
 *              });
 *              myViewerModel.build();
 *              myDataModel.build();
 *          }
 *     });
 * ````
 *
 * Saving an XKT file from a {@link @xeokit/datamodel!DocModel | DocModel}:
 *
 * ````javascript
 * import {DocModel} from "@xeokit/docmodel";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const myDocModel = new DocModel();
 *
 * //...
 *
 * await myDocModel.build();
 *
 * const arrayBuffer = saveXKT({
 *     model: myDocModel
 * });
 * ````
 *
 * Saving an XKT file from a {@link @xeokit/viewer!ViewerModel | ViewerModel}:
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
 * const myViewerModel= myViewer.createModel({
 *     id: "myModel"
 * });
 *
 * //...
 *
 * await myViewerModel.build();
 *
 * const arrayBuffer = saveXKT({
 *      model: myViewerModel
 * });
 * ````
 *
 * Saving an XKT file from a {@link @xeokit/viewer!ViewerModel | ViewerModel} and a {@link @xeokit/datamodel/DataModel}:
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
 * const myViewerModel= myViewer.createModel({
 *     id: "myModel"
 * });
 *
 * //...build viewer model...
 *
 * const data = new Data();
 *
 * const myDataModel = data.createModel({
 *      id: "myModel"
 * });
 *
 * //...build data model...
 *
 * await myViewerModel.build();
 * myDataModel.build();
 *
 * const arrayBuffer = saveXKT({
 *      model: myViewerModel,
 *      dataModel: myDataModel
 * });
 * ````
 *
 * @module @xeokit/xkt
 */
export * from "./loadXKT";
export * from "./saveXKT";