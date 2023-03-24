/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/viewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/viewer)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/xeokit_viewer_logo.png"/>
 *
 * # xeokit Web Model Viewer
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
 * [![](https://mermaid.ink/img/pako:eNqtVktv2zAM_iuGTtvQJBuwk1H00gK9pFiR7nExUMgyE2uRLU-Ss6Rd__uolyMn7i5rDjElfvz4ECn7mTBZAckJE1TrG043ijZFW3EFzHDZZstV0Tpd9p3Db1DZc9Fm-BOSUQEPoHacgd_SDNog7hCrvaigrUCB8iumgBqwVO_eF-1Lyh2ZGW13NBjL8ifGoaOiAUWDLx_evaAtBLWgB1A6dbO0O9bPceshsRtrlnxTm7OgHEWMjFcTUf3qqeDmsHJpnlh_ccBT8x3XvBSxaCAQAkFVYxDCBhI39goDCDKTQir-FAyZ4F1HB56Os-1xRWlZJrFcu8rFOOAAWTxEufVS3yXwtEjRqJM6C1bYHFmCvuHK1S4irTpCXchZil6FdnDoy0taaqMoM1dXCeYHlLfLETBRLtPGiz4b0Jpuhk5wkDQh25kDFhteTPaX64M7qx5aQwBVo6ZwVA4T-SY4_LlHkrLnooqLCjBheTjnnO4VTKy2aQ3YO9w4BW1ANmDUwa8M7E2vsEImOYPIZqgQnIXJlP2mxvGJtegow0YOSGoU3yd-b4OP1Dcq_aVQkE8Fmc2u3HM1DPyE0qWa43BoOzZPNjW3dQR9CCBfj1fV7giC1sv_ZgiLFGRLWbTu3y5jiLdDNceqj_M5ar8m1U3kAfV5gJznjxi75RVn2zHcRE7DSrLIcYo6BRpa23aTZO7e8jovhvBfczg6pOtw0Z4xx1GfUKV3RtEOw3v5ZzY7mec8400noPHRnyPvv70CxRuPbeNrqFawzgpSG9PpfLHYg9xyM99wU_flnMuFrraLSjK9cO0LevHoIY87Zz_3NPPaNNg5mS8I0lqTgqS-3sTT2M-ElzD9b-HLU409Bvqx3_BW-F-fnuboL9B6X-SC4KqhvMJvDHd1FMTUeKIFyVGsYE17YWxMLwilvZEPh5aR3KgeLkjfVXibhq8Skq-p0LgLFTdS3YXvFvt4-QsNG_td?type=png)](https://mermaid.live/edit#pako:eNqtVktv2zAM_iuGTtvQJBuwk1H00gK9pFiR7nExUMgyE2uRLU-Ss6Rd__uolyMn7i5rDjElfvz4ECn7mTBZAckJE1TrG043ijZFW3EFzHDZZstV0Tpd9p3Db1DZc9Fm-BOSUQEPoHacgd_SDNog7hCrvaigrUCB8iumgBqwVO_eF-1Lyh2ZGW13NBjL8ifGoaOiAUWDLx_evaAtBLWgB1A6dbO0O9bPceshsRtrlnxTm7OgHEWMjFcTUf3qqeDmsHJpnlh_ccBT8x3XvBSxaCAQAkFVYxDCBhI39goDCDKTQir-FAyZ4F1HB56Os-1xRWlZJrFcu8rFOOAAWTxEufVS3yXwtEjRqJM6C1bYHFmCvuHK1S4irTpCXchZil6FdnDoy0taaqMoM1dXCeYHlLfLETBRLtPGiz4b0Jpuhk5wkDQh25kDFhteTPaX64M7qx5aQwBVo6ZwVA4T-SY4_LlHkrLnooqLCjBheTjnnO4VTKy2aQ3YO9w4BW1ANmDUwa8M7E2vsEImOYPIZqgQnIXJlP2mxvGJtegow0YOSGoU3yd-b4OP1Dcq_aVQkE8Fmc2u3HM1DPyE0qWa43BoOzZPNjW3dQR9CCBfj1fV7giC1sv_ZgiLFGRLWbTu3y5jiLdDNceqj_M5ar8m1U3kAfV5gJznjxi75RVn2zHcRE7DSrLIcYo6BRpa23aTZO7e8jovhvBfczg6pOtw0Z4xx1GfUKV3RtEOw3v5ZzY7mec8400noPHRnyPvv70CxRuPbeNrqFawzgpSG9PpfLHYg9xyM99wU_flnMuFrraLSjK9cO0LevHoIY87Zz_3NPPaNNg5mS8I0lqTgqS-3sTT2M-ElzD9b-HLU409Bvqx3_BW-F-fnuboL9B6X-SC4KqhvMJvDHd1FMTUeKIFyVGsYE17YWxMLwilvZEPh5aR3KgeLkjfVXibhq8Skq-p0LgLFTdS3YXvFvt4-QsNG_td)
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
 *  We'll start by importing the modules we need:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
 * import {CameraControl} from "@xeokit/cameracontrol";

 * ````
 *
 * Create a {@link @xeokit/scene!Scene} to hold our model representations:
 *
 * ````javascript
 * const scene = new Scene();
 * ````
 *
 * Create a {@link @xeokit/viewer!Viewer} to view our Scene, configured with
 * a {@link @xeokit/webglrenderer!WebGLRenderer}:
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene,
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
 * proxies them with {@link ViewObject | ViewObjects}, which represent and control their appearance within the View's canvas.
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