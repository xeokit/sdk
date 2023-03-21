/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/viewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/viewer)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/xeokit_viewer_logo.png"/>
 *
 * # Web Model Viewer
 *
 * * {@link @xeokit/viewer!Viewer}
 * * Interactively view large models, at full coordinate precision, in all major browsers including mobile
 * * Independently move/show/hide/x-ray/highlight/colorize/slice objects
 * * Combine multiple, federated models
 * * Multiple canvases
 * * Low memory footprint
 * * Double-precision coordinate accuracy
 * * Programmatically build models
 * * Load and save XKT
 * * Load XKT, glTF, LAS..
 * * Browser graphics API agnostic - adapt with {@link WebGLRenderer}
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/viewer
 * ````
 *
 * ## Usage
 *
 * * [Creating a Viewer](#creating-a-viewer)
 * * [Creating a View](#creating-a-view)
 * * [Adding a CameraControl](#adding-a-cameracontrol)
 * * [Creating a SceneModel](#creating-a-scene)
 * * [Reading the Contents of a SceneModel](#reading-the-contents-of-a-scene)
 * * [Showing and Hiding Objects](#showing-and-hiding-objects)
 * * [Highlighting, Selecting and X-Raying Objects](#highlighting-selecting-and-x-raying-objects)
 * * [Creating a Second View](#creating-a-second-view)
 * * [Slicing Objects](#slicing-objects)
 * * [Saving and Loading BCF](#saving-and-loading-bcf)
 * * [Saving and Loading XKT](#saving-and-loading-xkt)
 * * [BCF Revisited](#bcf-revisited)
 * * [Adding a ViewLayer](#adding-a-viewlayer)
 * * [BCF with ViewLayers](#bcf-with-viewlayers)
 *
 * ### Creating a Viewer
 *
 *  We'll start by importing the modules we need:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
 * import {CameraControl} from "@xeokit/cameracontrol";
 * import {saveBCFViewpoint, loadBCFViewpoint} from "@xeokit/bcf";
 * import {saveXKT, loadXKT} from "@xeokit/xkt";
 * ````
 *
 * Create a {@link @xeokit/scene!Scene} to hold our model representations:
 *
 * ````javascript
 * const myScene = new Scene();
 * ````
 *
 * Create a {@link @xeokit/viewer!Viewer} to view our Scene, configured with
 * a {@link @xeokit/webglrenderer!WebGLRenderer}:
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene: myScene,
 *     renderer: new WebGLRenderer({ })
 * });
 * ````
 *
 * ### Creating a View
 *
 * Within our Viewer, create a {@link @xeokit/viewer!View} and arrange its {@link @xeokit/viewer!Camera}:
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 * ````
 *
 * ### Adding a CameraControl
 *
 * > *See [@xeokit/cameracontrol](/docs/modules/_xeokit_cameracontrol.html)*
 *
 * Add a {@link @xeokit/cameracontrol!CameraControl} to the View, to control the Camera from mouse and touch input:
 *
 * ````javascript
 * const myCameraControl = new CameraControl({
 *      view: view1
 * });
 * ````
 *
 * ### Creating a SceneModel
 *
 * > *See [@xeokit/scene](/docs/modules/_xeokit_scene.html)*
 *
 * Our {@link @xeokit/scene!Scene | Scene } contains geometric representations of our models and objects,
 * with materials and textures.
 *
 * Within the Scene, create a {@link @xeokit/scene!SceneModel | SceneModel} that contains a couple
 * of textured {@link @xeokit/scene!SceneModel | SceneObjects}:
 *
 * ````javascript
 * const sceneModel = myScene.createModel();
 *
 * sceneModel.createGeometry({
 *      id: "myGeometry",
 *      primitive: TrianglesPrimitive,
 *      positions: [202, 202, 202, 200, 202, 202, ...],
 *      indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, ...]
 * });
 *
 * sceneModel.createTexture({
 *      id: "myColorTexture",
 *      src: "myTexture",
 *      encoding: LinearEncoding, // Demo some texture configs
 *      magFilter: LinearFilter,
 *      minFilter: LinearFilter
 * });
 *
 * sceneModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture"
 * });
 *
 * sceneModel.createMesh({
 *     id: "myMesh1",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createMesh({
 *     id: "myMesh2",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh1"]
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh2"]
 * });
 *
 * sceneModel.build();
 * ````
 *
 * As soon as we've called {@link @xeokit/scene!SceneModel.build | SceneModel.build}, two new objects appear
 * in the View's canvas.
 *
 * ### Reading the Contents of a SceneModel
 *
 * A {@link @xeokit/scene!SceneModel | SceneModel} lets us read back all the geometry, materials, textures
 * and objects we create within it.
 *
 * Let's access our SceneModel. and find some of those components within it using their IDs:
 *
 * ```` javascript
 * const sceneModel = myScene.models["myModel"];
 * const texture = mySceneModel.textures["myColorTexture"];
 * const textureSet = mySceneModel.textureSets["myTextureSet"];
 *
 * const myGeometry = mySceneModel.geometries["myGeometry"];
 * const bucket0 = myGeometry.buckets[0];
 * const bucket0Positions = bucket0.positions;
 * const bucket0Indices = bcket0.indices;
 *
 * const myMesh1 = mySceneModel.meshes["myMesh1"];
 * const myGeometryAgain = myMesh1.geometry;
 *
 * const myObject1 = mySceneModel.objects["myObject1"];
 * const myObject2 = mySceneModel.objects["myObject2"];
 *
 * const myMesh1Again = myObject1.mesh;
 * ````
 *
 * ### Showing and Hiding Objects
 *
 * Hide one of the objects in the View's canvas:
 *
 * ````javascript
 * view1.setObjectsVisible(["myObject1"], false);
 * ````
 *
 * Another way to hide the object:
 *
 * ````javascript
 * view1.objects["myObject1"].visible = false;
 * ````
 *
 * Show the object again:
 *
 * ````javascript
 * view1.objects["myObject1"].visible = true;
 * ````
 *
 * ### Highlighting, Selecting and X-Raying Objects
 *
 * The functions for highlighting, selecting, colorizing and X-raying objects work the same as hiding and
 * showing, as just described.
 *
 * Let's highlight the first object in our View:
 *
 * ````javascript
 * view1.objects["myObject1"].highlighted = true;
 * ````
 *
 * ### Creating a Second View
 *
 * A Viewer can have many Views, each providing an independent view of the Scene in a separate
 * HTML canvas. Each View can have a completely different viewpoint, projection, and configuration of which objects
 * are visible, x-rayed, highlighted etc.
 *
 * Create a second View, with a separate canvas, that shows the other object highlighted instead:
 *
 * ```` javascript
 * const view2 = myViewer.createView({
 *      id: "myView2",
 *      canvasId: "myView2"
 * });
 *
 * view2.camera.eye = [-3.933, 2.855, 27.018];
 * view2.camera.look = [4.400, 3.724, 8.899];
 * view2.camera.up = [-0.018, 0.999, 0.039];
 *
 * view2.objects["myObject1"].highlighted = true;
 * ````
 *
 * A View is able to show an independent view of {@link @xeokit/scene!SceneModel | SceneObjects} by
 * proxying them with {@link ViewObject | ViewObjects}, which represent and control their appearance within the View's canvas.
 *
 * ### Slicing Objects
 *
 * Each View can have an unlimited number of interactive {@link SectionPlane | SectionPlanes}, with which we can use to slice open objects
 * to view interior structures.
 *
 * Create a couple of SectionPlanes within our second View, to slice through one of our
 * objects, then adjust the direction of one of the SectionPlanes:
 *
 * ````javascript
 * const mySlice1 = view2.createSlice({
 *     id: "mySlice1",
 *     pos: [0,0,0],
 *     dir: [-1,-1,-1]
 * });
 *
 * const mySlice2 = view2.createSlice({
 *     id: "mySlice2",
 *     pos: [0,0,0],
 *     dir: [1,1,.5]
 * });
 *
 * mySlice1.dir = [1,1,1];
 * ````
 * 
 * ### Saving and Loading BCF
 *
 * > *See [@xeokit/bcf](/docs/modules/_xeokit_bcf.html)*
 *
 * The BIM Collaboration Format (BCF) is a structured file format suited to issue tracking with a building information
 * model. BCF is designed primarily for defining views of a building model and associated information on collisions
 * and errors connected with specific objects in the view.
 *
 * Save a snapshot of our second View as a JSON-encoded BCF viewpoint:
 *
 * ````javascript
 * const bcfViewpoint = saveBCFViewpoint({
 *      view: view2
 * });
 * ````
 *
 * Now load that BCF viewpoint into the first View:
 *
 * ````javascript
 * loadBCFViewpoint({
 *      bcfViewpoint,
 *      view: view1
 * });
 * ````
 *
 * Now the first View shows exactly the same thing as the second View - the first first object is highlighted in both Views.
 *
 * In practice, you would be using this functionality to synchronize Views belonging to different Viewers, or to exchange
 * viewpoints with any other BIM software that supports BCF interoperability.
 *
 * ### Saving and Loading XKT
 *
 * > *See [@xeokit/xkt](/docs/modules/_xeokit_xkt.html)*
 *
 * XKT is xeokit's native binary model format, that compresses model representations and semantic data into
 * a compact Web-friendly payload that we can load quickly over the network into a Viewer.
 *
 * Save our SceneModel to an XKT file within an ArrayBuffer:
 *
 * ````javascript
 * const xktArrayBuffer = saveXKT({
 *     sceneModel
 * });
 *````
 *
 * Now let's destroy our SceneModel, then re-create it again from the XKT file we just saved:
 *
 * ````javascript
 * sceneModel.destroy();
 *
 * const sceneModel2 = myScene.createModel();
 *
 * loadXKT({
 *     data: xktArrayBuffer,
 *     sceneModel: sceneModel2
 * });
 *
 * sceneModel2.build();
 * ````
 *
 * Both Views now show the two objects once more, in their original, unhighlighted state. Their highlighted state, after
 * we highlighted them earlier,  got lost when we destroyed and recreated the SceneModel.
 *
 * ### BCF Revisited
 *
 * Recall that BCF viewpoint we captured from the first View, in which the first object was highlighted? To give a little
 * more insight into how things fit together, let's now load that BCF viewpoint back into the first View, which will
 * make that first object appear again highlighted in that canvas:
 *
 * ````javascript
 * loadBCFViewpoint({
 *      bcfViewpoint,
 *      view: view1
 * });
 * ````
 *
 * Meanwhile, both objects will remain un-highlighted in the second View.
 *
 * ### Adding a ViewLayer
 *
 * Sometimes we want to create SceneModels whose objects will never be included in any BCF viewpoints that we save, and
 * will never be disturbed by any viewpoints that we load.
 *
 * An example of such a case is a skybox, which we'd never want included in any BCF viewpoints, or hidden
 * whenever we load a BCF viewpoint.
 *
 * TODO TODO TODO TODO
 *
 * ````javascript
 * const modelViewLayer = view.createLayer({
 *     id: "myEnviromentViewLayer"
 * });
 * ````
 *
 * Now we'll create a SceneModel for our skybox in that ViewLayer:
 *
 * ````javascript
 * const skyboxSceneModel = myVScene.createModel({
 *      id: "mySkyBox",
 *      viewLayerId: "myEnviromentViewLayer"
 * });
 *
 * skyboxSceneModel.createObject({
 *      id: "skyBox",
 *      //...
 * });
 *
 * skyboxSceneModel.build();
 * ````
 *
 * Now we can save that View as a BCF viewpoint that will never include our skybox objects:
 *
 * ````javascript
 * const bcfViewpointAgain = saveBCFViewpoint({
 *      view: view2,
 *      excludeViewLayerIds: ["myEnviromentViewLayer"]
 * });
 * ````
 *
 * We can also load that viewpoint back into our View, in a way that won't disrupt our skybox:
 *
 * ````javascript
 * loadBCFViewpoint({
 *      bcfViewpoint: bcfViewpointAgain
 *      view: view2,
 *      excludeViewLayerIds: ["myEnviromentViewLayer"]
 * });
 * ````
 *
 * @module @xeokit/viewer
 */


export * from "./Viewer";
export * from "./ViewParams";
export * from "./Renderer";
export * from "./Camera";
export * from "./RTCViewMat";
export * from "./Frustum";
export * from "./Ortho";
export * from "./Perspective";
export * from "./CustomProjection";
export * from "./CameraFlightAnimation";
export * from "./AmbientLight";
export * from "./DirLight";
export * from "./PointLight";
export * from "./EmphasisMaterial";
export * from "./EdgeMaterial";
export * from "./PointsMaterial";
export * from "./Metriqs";
export * from "./View";
export * from "./ViewLayer";
export * from "./ViewObject";
export * from "./SectionPlane";
export * from "./SAO";
export * from "./PickParams";
export * from "./PickResult";
export * from "./ViewLayerParams";
export * from "./CreateModelParams";