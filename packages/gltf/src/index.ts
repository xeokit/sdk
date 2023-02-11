/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="media://images/xeokit_gltf_logo.svg"/>
 *
 * ## Model Loader for glTF File Format
 *
 * * [glTF](https://en.wikipedia.org/wiki/GlTF) is an industry standard format for 3D scenes and models
 * * {@link loadGLTF} loads glTF into a {@link @xeokit/core/components!BuildableModel | BuildableModel} and an optional {@link @xeokit/datamodel!DataModel | DataModel}.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/gltf
 * ````
 *
 * ## Usage
 *
 * Loading a glTF file into a {@link @xeokit/scratchmodel!ScratchModel | ScratchModel}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {loadGLTF} from "@xeokit/gltf";
 *
 * const myDocModel = new ScratchModel();
 *
 * fetch("myModel.glb")
 *     .then(response => {
 *          if (response.ok) {
 *              loadGLTF({
 *                  gltf: response.arrayBuffer(),
 *                  model: myDocModel
 *              });
 *              myDocModel.build();
 *          }
 *     });
 * ````
 *
 * Loading a glTF file into a {@link @xeokit/viewer!ViewerModel | ViewerModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {loadGLTF} from "@xeokit/gltf";
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
 * fetch("myModel.glb")
 *     .then(response => {
 *          if (response.ok) {
 *              loadGLTF({
 *                  gltf: response.arrayBuffer(),
 *                  model: myViewerModel
 *              });
 *              myViewerModel.build();
 *          }
 *     });
 * ````
 *
 * @module @xeokit/gltf
 */
export * from "./loadGLTF";