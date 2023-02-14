/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/autzen.png"/>
 *
 * <br>
 *
 * ## SceneModel Loader for LAS/LAZ File Format
 *
 * * [LAS/LAZ](https://en.wikipedia.org/wiki/LAS) is an industry standard format for 3D point cloud scans
 * * {@link loadLAS} loads LAS/LAZ into a {@link @xeokit/core/components!SceneModel | SceneModel} and an optional {@link @xeokit/datamodel!DataModel | DataModel}
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
 * const sceneModel = new ScratchModel();
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
 * Loading a LAS file into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/core/components!SceneModel | SceneModel}:
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