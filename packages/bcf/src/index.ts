/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fbcf.svg)](https://badge.fury.io/js/%40xeokit%2Fbcf)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/bcf/badge)](https://www.jsdelivr.com/package/npm/@xeokit/bcf)
 * 
 * <img style="padding:20px" src="media://images/xeokit_bcf_logo.png"/>
 *
 * # Load and Save {@link "@xeokit/viewer" | Viewer} State as BCF
 *
 * * {@link loadBCFViewpoint} loads a JSON-encoded BCF viewpoint into a {@link @xeokit/viewer!View | View} or a {@link @xeokit/viewer!ViewLayer | ViewLayer}
 * * {@link saveBCFViewpoint} saves a {@link @xeokit/viewer!View | View} or a {@link @xeokit/viewer!ViewLayer | ViewLayer} to a JSON-encoded BCF viewpoint
 * * {@link BCFViewpoint} represents a BCF viewpoint
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/bcf
 * ````
 *
 * ## Usage
 *
 * ### Saving and Loading a View as BCF
 *
 * Let's create a Viewer with a View and a SceneModel. We'll imagine that we've created several objects within our
 * SceneModel.
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl2renderer";
 * import {loadBCFViewpoint} from "@xeokit/bcf";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({
 *         //...
 *     })
 * });
 *
 * const myView = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * const mySceneModel = myViewer.scene.createModel({
 *      id: "myModel"
 * });
 *
 * //...create some objects etc
 *
 * mySceneModel.build();
 * ````
 *
 * Use {@link saveBCFViewpoint} to save the {@link @xeokit/viewer!View | View} to a {@link BCFViewpoint}:
 *
 * ````javascript
 * const myBCFViewpoint = saveBCFViewpoint({
 *      view: myView
 * });
 * ````
 *
 * Use {@link loadBCFViewpoint} to load the {@link BCFViewpoint} back into the {@link @xeokit/viewer!View | View}:
 *
 * ````javascript
 * loadBCFViewpoint({
 *     bcfViewpoint: myBCFViewpoint,
 *     view: myView
 * });
 * ````
 *
 * ### Saving and Loading a ViewLayer as BCF
 *
 * As before, let's create a Viewer with a View and a SceneModel.
 *
 * This time, we'll add two ViewLayers to our View, and we'll associate our SceneModel with one of those
 * ViewLayers.
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl2renderer";
 * import {loadBCFViewpoint} from "@xeokit/bcf";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({
 *         //...
 *     })
 * });
 *
 * const myView = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * const foregroundViewLayer = myView.createLayer({
 *     id: "foreground"
 * });
 *
 * const backgroundViewLayer = myView.createLayer({
 *     id: "background"
 * });
 *
 * const mySceneModel = myViewer.scene.createModel({
 *      id: "myModel",
 *      viewLayerId: "foreground"
 * });
 *
 * //...create some objects etc
 *
 * mySceneModel.build();
 *
 * const myOtherSceneModel = myViewer.scene.createModel({
 *      id: "myOtherModel",
 *      viewLayerId: "background"
 * });
 *
 * //...create some objects etc
 *
 * myOtherSceneModel.build();
 * ````
 *
 * Now we can use {@link saveBCFViewpoint} to save specifically the {@link @xeokit/viewer!ViewLayer | ViewLayer} that
 * contains our SceneModel to a {@link BCFViewpoint}, while ignoring the other ViewLayer:
 *
 * ````javascript
 * const myBCFViewpoint = saveBCFViewpoint({
 *      view: myView,
 *      includeViewLayerIds: ["foreground"],
 *      excludeViewLayerIds: ["background"] // Unneccessary, but we'll show it anyway
 * });
 * ````
 *
 * Use {@link loadBCFViewpoint} to load the {@link BCFViewpoint} back into the {@link @xeokit/viewer!ViewLayer | ViewLayer}:
 *
 * ````javascript
 * loadBCFViewpoint({
 *     bcfViewpoint: myBCFViewpoint,
 *     view: myView
 * });
 * ````
 *
 * @module @xeokit/bcf
 */
export * from "./loadBCFViewpoint";
export * from "./saveBCFViewpoint";
export * from "./SaveBCFViewpointParams";
export * from "./LoadBCFViewpointParams";
export * from "./BCFViewpoint";