/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltf.svg)](https://badge.fury.io/js/%40xeokit%2Fgltf)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltf/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltf)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="media://images/xeokit_gltf_logo.svg"/>
 *
 * # glTF Model Loader
 *
 * * [glTF](https://en.wikipedia.org/wiki/GlTF) is an industry standard format for 3D scenes and models.
 * * {@link loadGLTF} loads glTF into a {@link @xeokit/scene!SceneModel | SceneModel} and an
 * optional {@link @xeokit/data!DataModel | DataModel}.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/gltf
 * ````
 *
 * ## Usage
 *
 * Loading a glTF file into a {@link @xeokit/data!DataModel | DataModel} and a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import {Scene} from "@xeokit/scene";
 * import {loadGLTF} from "@xeokit/gltf";
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
 * fetch("myModel.glb").then(response => {
 *
 *     response.arrayBuffer().then(data => {
 *
 *          loadGLTF({ data, dataModel, sceneModel });
 *
 *          dataModel.build();
 *          sceneModel.build();
 *     })
 * });
 * ````
 *
 * @module @xeokit/gltf
 */
export * from "./loadGLTF";