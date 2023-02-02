/**
 * ## Model Loader and Saver for XKT File Format
 *
 * * XKT is xeokit's native compressed model format
 * * {@link loadXKT|loadXKT} loads XKT into a {@link BuildableModel}, which is implemented by {@link ScratchModel} and {@link ViewerModel}
 * * {@link saveXKT|saveXKT} saves XKT from a {@link Model}, which is implemented by {@link ScratchModel} and {@link ViewerModel}
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/xkt
 * ````
 *
 * ## Usage
 *
 * Loading an XKT file into a {@link ScratchModel}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {loadXKT} from "@xeokit/xkt";
 *
 * const myScratchModel = new ScratchModel();
 *
 * fetch("myModel.xkt")
 *     .then(response => {
 *          if (response.ok) {*
 *              loadXKT(response.arrayBuffer(), myScratchModel);
 *              myScratchModel.built();
 *          }
 *     });
 * ````
 *
 * Loading an XKT file into a {@link ViewerModel}:
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
 *          if (response.ok) {*
 *              loadXKT(response.arrayBuffer(), myViewerModel);
 *              myViewerModel.build();
 *          }
 *     });
 * ````
 *
 * Saving an XKT file from a {@link ScratchModel}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const myScratchModel = new ScratchModel();
 *
 * //...
 *
 * await myScratchModel.build();
 *
 * const arrayBuffer = saveXKT(myScratchModel);
 * ````
 *
 * Saving an XKT file from a {@link ViewerModel}:
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
 * const arrayBuffer = saveXKT(myViewerModel);
 * ````
 *
 * @module @xeokit/xkt
 */
export * from "./loadXKT";
export * from "./saveXKT";