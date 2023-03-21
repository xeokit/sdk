/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fbcf.svg)](https://badge.fury.io/js/%40xeokit%2Fbcf)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/bcf/badge)](https://www.jsdelivr.com/package/npm/@xeokit/bcf)
 * 
 * <img style="padding:20px; padding-bottom:10px; " src="media://images/xeokit_bcf_logo.png"/>
 *
 * # Import and Export BCF
 *
 * The BIM Collaboration Format ({@link BCFViewpoint}) is an open file
 * format for exchanging data and collaborating on 3D models and building information. It was created by the
 * buildingSMART organization and is widely used in the architecture, engineering, and construction (AEC) industry.
 *
 * The xeokit SDK provides support for BCF through functions to import and export Viewer state as BCF viewpoints.
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
 * First, import the components we need:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Data} from "@xeoki/data";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {loadXKT} from "@xeokit/loadXKT";
 * import {saveBCFViewpoint, loadBCFViewpoint} from "@xeokit/bcf";
 * import * as ifcTypes from "@xeokit/datatypes/ifcTypes";
 * ````
 *
 * Create a {@link @xeokit/scene!Scene}, which will contain our model objects, materials and geometry.
 *
 * Within the Scene, create a {@link @xeokit/scene!SceneModel}.
 *
 * ````javascript
 * const myScene = new Scene();
 *
 * const mySceneModel = myScene.createModel({
 *     id: "myModel"
 * });
 * ````
 *
 * Create a {@link @xeokit/data!Data}, which will contain our model's semantic data as en entity-relationship graph.
 *
 * Within the Data, create a {@link @xeokit/data!DataModel}.
 *
 * ````javascript
 * const myData = new Data();
 *
 * const myDataModel = myData.createModel({
 *     id: "myModel"
 * });
 * ````
 *
 * Then we'll fetch an ArrayBuffer containing an XKT file and use {@link @xeokit/xkt!loadXKT} to
 * load it into our SceneModel and DataModel.
 *
 * > * See {@link "@xeokit/scene"} for info on creating SceneModels.
 * > * See {@link "@xeokit/data"} for info on creating DataModels.
 *
 * ````javascript
 * fetch("myModel.xkt").then(response => {
 *     response.arrayBuffer().then(data => {
 *
 *          loadXKT({ data, sceneModel, dataModel });
 *
 *          mySceneModel.build();
 *          myDataModel.build();
 *    });
 * });
 * ````
 *
 * That will happen asynchronously.
 *
 * In the meantime, let's create a {@link @xeokit/viewer!Viewer} and connect it to our Scene. We'll configure our
 * Viewer with a {@link @xeokit/webglrenderer!WebGLRenderer}, so that it will use the browser's WebGL graphics API
 * for rendering.
 *
 * As always, we also need to give our Viewer at least one {@link @xeokit/viewer!View | View}, to bind it to an
 * HTML canvas element.
 *
 * ````javascript
 * const myViewer = new Viewer({
 *      id: "myViewer",
 *      scene: myScene,
 *      renderer: new WebGLRenderer({
 *         //...
 *      })
 * });
 *
 * const myView = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myCanvas"
 * });
 * ````
 *
 * When our XKT has loaded, that call to {@link @xeokit/scene!SceneModel.build | SceneModel.build} will finalize our SceneModel
 * and cause it to immediately appear in the View's canvas.
 *
 * That call will also trigger {@link @xeokit/scene!SceneModel.onBuilt | SceneModel.onBuilt} and
 * {@link @xeokit/data!DataModel.onBuilt | DataModel.onBuilt} events.
 *
 * On the DataModel.onBuilt event, we'll customize the View by arranging the {@link @xeokit/viewer!Camera} and applying
 * an X-ray effect tp a couple of objects, then we'll use {@link saveBCFViewpoint} to save the state of the View to
 * a BCF viewpoint.
 *
 * > Once the SceneModel and DataModel have been built, we can no longer add anything to them.
 *
 * ````javascript
 * myDataModel.onBuilt.one(()=>{
 *
 *      myView.camera.eye = [0,0,-33];
 *      myView.camera.look = [0,0,0];
 *      myView.camera.up = [0,0,0];
 *
 *      myView.setObjectsVisible(myView.objectIds, false);
 *      myView.setObjectsVisible(["myObject1", "myObject2", "myObject3", ...], true);
 *
 *      myView.setObjectsXRayed(["myObject1", "myObject", ...], true);
 *
 *      const myBCFViewpoint = saveBCFViewpoint({
 *          view: myView
 *      });
 *
 *      // ...
 * });
 * ````
 *
 * Now that we've saved the {@link BCFViewpoint}, we could now use {@link loadBCFViewpoint} to load
 * the {@link BCFViewpoint} back into the {@link @xeokit/viewer!View | View}:
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
 * This time, we'll add two {@link @xeokit/viewer!ViewLayer | ViewLayers} to our View, and we'll associate our SceneModel with one of those
 * ViewLayers. ViewLayers allow us to partition our ViewObjects into bins, so that we can conveniently focus certain operations (eg. import/export
 * BCF) only on the relevant ViewObjects.
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Data} from "@xeoki/data";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {loadBCFViewpoint} from "@xeokit/bcf";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene; myScene,
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
 * const mySceneModel = myScene.createModel({
 *      id: "myModel",
 *      viewLayerId: "foreground"
 * });
 *
 * //...create some objects, load XKT etc
 *
 * mySceneModel.build();
 *
 * const myOtherSceneModel = myScene.createModel({
 *      id: "myOtherModel",
 *      viewLayerId: "background"
 * });
 *
 * //...create some objects, load XKT etc
 *
 * myOtherSceneModel.build();
 * ````
 *
 * Now we can use {@link saveBCFViewpoint} to save the states of only the {@link @xeokit/viewer!ViewObject | ViewObjects} in the
 * {@link @xeokit/viewer!ViewLayer | ViewLayer} that contains our SceneModel to a {@link BCFViewpoint}, while ignoring the
 * other ViewLayer:
 *
 * ````javascript
 * const myBCFViewpoint = saveBCFViewpoint({
 *      view: myView,
 *      includeViewLayerIds: ["foreground"],
 *      excludeViewLayerIds: ["background"] // Unnecessary, but we'll show it anyway
 * });
 * ````
 *
 * Use {@link loadBCFViewpoint} to load the {@link BCFViewpoint} back into the {@link @xeokit/viewer!ViewLayer | ViewLayer}:
 *
 * ````javascript
 * loadBCFViewpoint({
 *     bcfViewpoint: myBCFViewpoint,
 *     view: myView,
 *     includeViewLayerIds: ["foreground"],
 *     excludeViewLayerIds: ["background"]
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