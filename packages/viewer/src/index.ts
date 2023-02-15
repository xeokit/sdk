/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/xeokit_viewer_logo.png"/>
 *
 * ## Web Model Viewer
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
 * * [Creating a SceneModel](#creating-a-scenemodel)
 * * [Reading the Contents of a SceneModel](#reading-the-contents-of-a-scenemodel)
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
 * Create a {@link @xeokit/viewer!Viewer}, configured with a {@link @xeokit/webgl!WebGLRenderer}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
 * import {CameraControl} from "@xeokit/controls";
 * import {saveBCFViewpoint, loadBCFViewpoint} from "@xeokit/bcf";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ })
 * });
 * ````
 *
 * ### Creating a View
 *
 * Create a {@link @xeokit/viewer!View} and arrange its {@link @xeokit/viewer!Camera}:
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
 * > *See [@xeokit/controls](/docs/modules/_xeokit_controls.html)*
 *
 * Add a {@link @xeokit/controls!CameraControl} to the View, to control the Camera from mouse and touch input:
 *
 * ````javascript
 * const myCameraControl = new CameraControl({
 *      view: view1
 * });
 * ````
 *
 * ### Creating a SceneModel
 *
 * The Viewer's {@link @xeokit/viewer!Scene | Scene } contains geometric representations of models and objects,
 * with materials and textures.
 *
 * Within the Scene, create a {@link @xeokit/core/components!SceneModel | SceneModel} that contains a couple
 * of textured {@link @xeokit/core/components!SceneObject | SceneObjects}:
 *
 * ````javascript
 * const sceneModel = myViewer.scene.createModel({
 *     id: "myModel"
 * });
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
 * As soon as we've called {@link @xeokit/core/components!SceneModel.build | SceneModel.build}, two new objects appear
 * in the View's canvas.
 *
 * ### Reading the Contents of a SceneModel
 *
 * A {@link @xeokit/core/components!SceneModel | SceneModel} lets us read back all the geometry, materials, textures
 * and objects we create within it.
 *
 * Let's access our SceneModel. and find some of those components within it using their IDs:
 *
 * ```` javascript
 * const sceneModel = myViewer.scene.models["myModel"];
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
 * A View is able to show an independent view of {@link @xeokit/core/components!SceneObject | SceneObjects} by
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
 * const sceneModel2 = myViewer.scene.createModel({
 *     id: "myModel"
 * });
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
 * An example of such a case is a skybox, which we'd implemented using a SceneModel whose object(s)
 * we'd always want to remain visible in the background whenever we load BCF viewpoints, and to never be included in
 * any BCF viewpoints that we save.
 *
 * Let's create a ViewLayer in our first View:
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
 * const skyboxSceneModel = myViewer.scene.createModel({
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
 *
 * @packageDocumentation
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
export * from "./Scene";
export * from "./ModelParams";