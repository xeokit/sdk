/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltf.svg)](https://badge.fury.io/js/%40xeokit%2Fgltf)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltf/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltf)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="media://images/xeokit_gltf_logo.svg"/>
 *
 * # glTF Model Loader
 *
 * * [glTF](https://en.wikipedia.org/wiki/GlTF) is an industry standard format for 3D scenes and models
 * * {@link loadGLTF} loads glTF into a {@link @xeokit/scene!SceneModel | SceneModel} and an optional {@link @xeokit/data!DataModel | DataModel}.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/gltf
 * ````
 *
 * ## Usage
 *
 * Loading a glTF file into a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {loadGLTF} from "@xeokit/gltf";
 *
 * const scene = new Scene();
 *
 * const sceneModel = scene.createModel();
 *
 * fetch("myModel.glb").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *          loadGLTF({ data, sceneModel });
 *          sceneModel.build();
 *     })
 * });
 * ````
 *
 * Loading a glTF file into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/scene!SceneModel | SceneModel}:
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
 * const sceneModel = myViewer.scene.createModel({
 *     id: "sceneModel"
 * });
 *
 * fetch("myModel.glb").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *          loadGLTF({ data, sceneModel });
 *          sceneModel.build();
 *      });
 * });
 * ````
 *
 * @module @xeokit/gltf
 */
export * from "./loadGLTF";