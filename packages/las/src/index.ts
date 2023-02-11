/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/autzen.png"/>
 *
 * <br>
 *
 * ## Model Loader for LAS/LAZ File Format
 *
 * * [LAS/LAZ](https://en.wikipedia.org/wiki/LAS) is an industry standard format for 3D point cloud scans
 * * {@link loadLAS} loads LAS/LAZ into a {@link @xeokit/core/components!BuildableModel | BuildableModel} and an optional {@link @xeokit/datamodel!DataModel | DataModel}
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/las
 * ````
 *
 * ## Usage
 *
 * Loading a LAS file into a {@link @xeokit/scratchmodel!ScratchModel | ScratchModel}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {loadLAS} from "@xeokit/las";
 *
 * const myDocModel = new ScratchModel();
 *
 * fetch("myModel.las")
 *     .then(response => {
 *          if (response.ok) {
 *              loadLAS({
 *                  las: response.arrayBuffer(),
 *                  model: myDocModel
 *              });
 *              myDocModel.build();
 *          }
 *     });
 * ````
 *
 * Loading a LAS file into a {@link @xeokit/viewer!ViewerModel | ViewerModel}:
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
 * const myViewerModel= myViewer.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("myModel.las")
 *     .then(response => {
 *          if (response.ok) {
 *              loadLAS({
 *                  las: response.arrayBuffer(),
 *                  model: myViewerModel
 *              });
 *              myViewerModel.build();
 *          }
 *     });
 * ````
 *
 * @module @xeokit/las
 */
export * from "./loadLAS";