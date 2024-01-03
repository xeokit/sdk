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
 * eon certain bins, exclusively. ViewLayers also allow us to restrict which SceneObjects are renderable in the Viewer's [phycially-based](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#pbr)
 * quality rendering mode. This allows us to disable wasteful quality rendering for objects that are not supposed to appear realistic, such as grids and other 3D helper objects.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNVU1v4jAQ_SuRT7srQKRAgKjiQqXdA6iI7oe0ysVJpsWtY2cdhy2l_Pd1_JEmkK7KJWbemzdj541zRAlPAYUoobgobgh-EDiLWEoEJJJw5q22EdOY95PAXxDeMWKe-QlgKQgQJlAkwMAs94pZmGUiAEuoUj99NpGInZqKTi_BbI9tEo8fVXWngDMQ2Kwpedi5eGEa3FDMwIYoPoBoFV5VEVfZhO4aeW1kValXoVaDWsJ1SdKODv-UmBJ52OrjOMu-1cTz9D0pSEzBbYQqClhop5rQ23SBZ6EasOuEUy7Ii01MKMlzXOvkJHl6-4dxHDd6WepTdH3AATx7ZJw_mVWZWxnBH80RNdKbh-ZEcl54VkXZpfleb4jQZ-mYFeyoegstF2ytjTT7-hrHhRQ4kYtFg_ML4q-rFrG5t7KQPNvUfbuyGZaCPDd3UVm0RpXvaafhtBnWFVz7gwIWLWdoKc35rzWMljGBE4tLQlP3JwW1W3641L40jsIjZoYwQn6E-v2Ffm7rMewA78xUmkcNfLGAKfIurPdnUbN-V-G8tMKrUGivgmp9AZrcsD6wt5imtLZgucosuYACmCw8wrxv39er-uborKGnN3QXQx2J0HAw-EA7rbNc2pvoopDze-jupwtGc34iZoWa2hvVX16R9t34rZA73omcuz9i9Zxcv_b7Z6MTeiTLKWTVCXYxNz8-RF3z5OkdYvO-WXKm3F2PiP4waCO34NbL8M3LQD2kGBkmqfo26fQIyZ2qEaFQLVO4xyVVPlFqiopLye8OLEHhPaYF9FCZp2ru7OesjkJKJBdr-8GrHj2UY4bCI3pGoT-dD4JgOJv644nvj-ejWQ8dUDgKZoPRfDjxx1fB_Go6np166IVzpTocTILJVGGjSTAMRrPxSMv91qAUJZz-AZsUb1U?type=png)](https://mermaid.live/edit#pako:eNqNVU1v4jAQ_SuRT7srQKRAgKjiQqXdA6iI7oe0ysVJpsWtY2cdhy2l_Pd1_JEmkK7KJWbemzdj541zRAlPAYUoobgobgh-EDiLWEoEJJJw5q22EdOY95PAXxDeMWKe-QlgKQgQJlAkwMAs94pZmGUiAEuoUj99NpGInZqKTi_BbI9tEo8fVXWngDMQ2Kwpedi5eGEa3FDMwIYoPoBoFV5VEVfZhO4aeW1kValXoVaDWsJ1SdKODv-UmBJ52OrjOMu-1cTz9D0pSEzBbYQqClhop5rQ23SBZ6EasOuEUy7Ii01MKMlzXOvkJHl6-4dxHDd6WepTdH3AATx7ZJw_mVWZWxnBH80RNdKbh-ZEcl54VkXZpfleb4jQZ-mYFeyoegstF2ytjTT7-hrHhRQ4kYtFg_ML4q-rFrG5t7KQPNvUfbuyGZaCPDd3UVm0RpXvaafhtBnWFVz7gwIWLWdoKc35rzWMljGBE4tLQlP3JwW1W3641L40jsIjZoYwQn6E-v2Ffm7rMewA78xUmkcNfLGAKfIurPdnUbN-V-G8tMKrUGivgmp9AZrcsD6wt5imtLZgucosuYACmCw8wrxv39er-uborKGnN3QXQx2J0HAw-EA7rbNc2pvoopDze-jupwtGc34iZoWa2hvVX16R9t34rZA73omcuz9i9Zxcv_b7Z6MTeiTLKWTVCXYxNz8-RF3z5OkdYvO-WXKm3F2PiP4waCO34NbL8M3LQD2kGBkmqfo26fQIyZ2qEaFQLVO4xyVVPlFqiopLye8OLEHhPaYF9FCZp2ru7OesjkJKJBdr-8GrHj2UY4bCI3pGoT-dD4JgOJv644nvj-ejWQ8dUDgKZoPRfDjxx1fB_Go6np166IVzpTocTILJVGGjSTAMRrPxSMv91qAUJZz-AZsUb1U)
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
 * const environmentViewLayer = view.createLayer({
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
 *      excludeLayerIds: ["myEnvironmentViewLayer"]
 * });
 * ````
 *
 * ````javascript
 * myViewer.viewModes.createViewMode({
 *    id: "qualityViewMode"
 * });
 *
 * myViewer.viewModes.createViewMode({
 *    id: "navigationViewMode"
 * });
 *
 * environmentViewLayer.setViewModes(["qualityViewMode"]};
 * 
 * myViewer.viewModes.setActiveViewMode("quality");
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
export * from "./Edges";
export * from "./PointsMaterial";
export * from "./LinesMaterial";
export * from "./Metriqs";
export * from "./View";
export * from "./ViewLayer";
export * from "./ViewObject";
export * from "./SectionPlane";
export * from "./SectionPlaneParams";
export * from "./SAO";
export * from "./PickParams";
export * from "./PickResult";
export * from "./ViewLayerParams";
export * from "./RendererViewObject";
export * from "./ResolutionScale";
export * from "./Texturing";
export * from "./TickParams";
export * from "./SnapshotParams";
export * from "./SnapshotResult";
