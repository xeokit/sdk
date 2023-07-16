/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/viewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/viewer)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/xeokit_viewer_logo.png"/>
 *
 * # xeokit Scene Viewer
 *
 * ---
 *
 * ### *The SDK's browser-based 3D/2D scene viewer*
 *
 * ---
 *
 * ## Features
 *
 * * Use a {@link @xeokit/viewer!Viewer} to interactively view a {@link @xeokit/scene!Scene} in all major browsers, including mobile.
 * * A Viewer has a {@link @xeokit/viewer!Renderer}, which is a pluggable strategy that adapts the Viewer to use various browser graphics APIs. Currently we have two
 * Renderer implementations:
 * {@link @xeokit/webglrenderer!WebGLRenderer} and WebGPURenderer.
 * * A Viewer can have multiple {@link @xeokit/viewer!View | Views}, each providing an independently configurable view of the Scene in a separate HTML canvas.
 * * Each View has a {@link @xeokit/viewer!ViewObject} for each of the {@link @xeokit/scene!SceneObject | SceneObjects} in the Scene, which represnts and controls that
 * SceneObject's appearance in the View's canvas.
 * The View creates and destroys its ViewObjects automatically, in order to proxy the SceneObjects.
 * * Each View also has it's own {@link @xeokit/viewer!Camera}, {@link @xeokit/viewer!DirLight | Lights} and {@link @xeokit/viewer!SectionPlane | SectionPlanes}.
 * * Each View can optionally organize its ViewObjects into {@link @xeokit/viewer!ViewLayer | ViewLayers}. These allow us to partition our ViewObjects into
 * different *bins* depending on what they represent in the View, and then conveniently focus our updates (toggle visibility, select, highlight, slice etc.)
 * eon certain bins, exclusively. ViewLayers also allow us to restrict which SceneObjects are renderable in the Viewer's [phycially-based](/docs/pages/GLOSSARY.html#pbr)
 * quality rendering mode. This allows us to disable wasteful quality rendering for objects that are not supposed to appear realistic, such as grids and other 3D helper objects.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNVctu2zAQ_BWBp7aIg-YqGL44QHqwEcPu48ILRW1iJhSpkpQbN82_l-9QtlzUF1E7s7PL9ZB6RVS2gGpEOdH6lpFHRTosWqaAGiZFtdpi4bHqO4NfoKpXLKrwUyBaUKBCQFMQEJYHy9RhSRUQAy71w8cQweKtVEx6lIgDiUmyebLVkwLpQJGw5uxxn-I6NLjhREAMcXIENSq8cpFUOYR2Rd4YWTl1Fxo16CVSl6yd6PDnQDgzx60fx0n2vSeeph-YZg2HtBFuKRChvW3CbzMFXpRtIK6p5FKx3zGRctb3JOv0jD6_vxHSNEUvSz_F1AccoYojk_I5rIY-yij5FEZUpJdDSyK91FVUsXYp_9dbpvwsE9PBieq3MHLBNtrIs-dz0mijCDWLRcH5Ac3dakQs9zZoI7tN7juV7YhR7KXchbNoRq3v-aThvBnWDs7-4EDUyBleynP-aY2gFUyQxJqB8Ta9tGB3K4_n2ufGsTgW4RBidIPRbLbwz20-hhPgLpzK8MjApwiEIhdhv7-IhvVFhdPSFnehOl4Fbn0Ghtw6D-w95imjLUSuNUuvQIMwumKi-vJ1vco3x2QNf3rrdDHkCEafr6__o53RLJfxJjorlPxep_vpjFGeHyyiUKm9sf31jnSYxu-V2ctJ5NT9WORzMv8zm50cnbpiXc-hcxOcYm6-XaCW18hSCmva7Hx_33t_juDRjG_CjNEVsoyOsNZ-cnw6RmZva2BU22ULD2Tg9u-3apZKBiN3R0FRbdQAV2joW3ua4kcK1Q-EaxuFlhmp1vEz5h5vfwF9HEi3?type=png)](https://mermaid.live/edit#pako:eNqNVctu2zAQ_BWBp7aIg-YqGL44QHqwEcPu48ILRW1iJhSpkpQbN82_l-9QtlzUF1E7s7PL9ZB6RVS2gGpEOdH6lpFHRTosWqaAGiZFtdpi4bHqO4NfoKpXLKrwUyBaUKBCQFMQEJYHy9RhSRUQAy71w8cQweKtVEx6lIgDiUmyebLVkwLpQJGw5uxxn-I6NLjhREAMcXIENSq8cpFUOYR2Rd4YWTl1Fxo16CVSl6yd6PDnQDgzx60fx0n2vSeeph-YZg2HtBFuKRChvW3CbzMFXpRtIK6p5FKx3zGRctb3JOv0jD6_vxHSNEUvSz_F1AccoYojk_I5rIY-yij5FEZUpJdDSyK91FVUsXYp_9dbpvwsE9PBieq3MHLBNtrIs-dz0mijCDWLRcH5Ac3dakQs9zZoI7tN7juV7YhR7KXchbNoRq3v-aThvBnWDs7-4EDUyBleynP-aY2gFUyQxJqB8Ta9tGB3K4_n2ufGsTgW4RBidIPRbLbwz20-hhPgLpzK8MjApwiEIhdhv7-IhvVFhdPSFnehOl4Fbn0Ghtw6D-w95imjLUSuNUuvQIMwumKi-vJ1vco3x2QNf3rrdDHkCEafr6__o53RLJfxJjorlPxep_vpjFGeHyyiUKm9sf31jnSYxu-V2ctJ5NT9WORzMv8zm50cnbpiXc-hcxOcYm6-XaCW18hSCmva7Hx_33t_juDRjG_CjNEVsoyOsNZ-cnw6RmZva2BU22ULD2Tg9u-3apZKBiN3R0FRbdQAV2joW3ua4kcK1Q-EaxuFlhmp1vEz5h5vfwF9HEi3)
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
 * * [Showing and Hiding Objects](#showing-and-hiding-objects)
 * * [Highlighting, Selecting and X-Raying Objects](#highlighting-selecting-and-x-raying-objects)
 * * [Creating a Second View](#creating-a-second-view)
 * * [Slicing Objects](#slicing-objects)
 * * [Adding a ViewLayer](#adding-a-viewlayer)
 *
 * ### Creating a Viewer
 *
 * Install these NPM modules:
 *
 * ````bash
 * npm install @xeokit/scene
 * npm install @xeokit/viewer
 * npm install @xeokit/ktx2
 * npm install @xeokit/webglrenderer
 * npm install @xeokit/constants
 * npm install @xeokit/cameracontrol
 * ````
 *
 *  In our JavaScript, import the modules:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {KTX2TextureTranscoder} from "@xeokit/ktx2";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/constants";
 * import {CameraControl} from "@xeokit/cameracontrol";
 * ````
 *
 * Create a {@link @xeokit/scene!Scene} to hold our scene graph:
 *
 * ````javascript
 * const scene = new Scene();
 * ````
 *
 * Create a {@link @xeokit/viewer!Viewer} to view our Scene.
 *
 * We'll configured it with
 * a {@link @xeokit/webglrenderer!WebGLRenderer}, which will adapt the Viewer to use the browser's WebGL graphics API.
 * We'll also equip our WebGLRenderer with a {@link @xeokit/ktx2!KTX2TextureTranscoder} so we that we can view compressed textures.
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderer: new WebGLRenderer({
 *          textureTranscoder: new KTX2TextureTranscoder({  // Optional, this is the default
 *              transcoderPath: "./../dist/basis/" // Optional, defaults to CDN
 *          })
 *      })
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
 * Within the Scene, we'll create a {@link @xeokit/scene!SceneModel | SceneModel} that contains a couple
 * of textured {@link @xeokit/scene!SceneModel | SceneObjects}:
 *
 * ````javascript
 * const sceneModel = scene.createModel();
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
 * To show an independent view of {@link @xeokit/scene!SceneModel | SceneObjects}, a View
 * proxies them with {@link @xeokit/viewer!ViewObject | ViewObjects}, which represent and control their appearance within the View's canvas.
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
 *      layerId: "myEnviromentViewLayer"
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
 *      excludeLayerIds: ["myEnviromentViewLayer"]
 * });
 * ````
 *
 * We can also load that viewpoint back into our View, in a way that won't disrupt our skybox:
 *
 * ````javascript
 * loadBCFViewpoint({
 *      bcfViewpoint: bcfViewpointAgain
 *      view: view2,
 *      excludeLayerIds: ["myEnviromentViewLayer"]
 * });
 * ````
 *
 * @module @xeokit/viewer
 */
export * from "./Viewer";
export * from "./ViewParams";
export * from "./Renderer";
export * from "./Camera";
export * from "./FrustumProjection";
export * from "./OrthoProjection";
export * from "./PerspectiveProjection";
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
export * from "./RendererViewObject";
