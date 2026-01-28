/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/xeokit_viewer_logo.png"/>
 *
 * # xeokit Viewer
 *
 * ---
 *
 * ### *The SDK's browser-based 3D/2D scene viewer*
 *
 * ---
 *
 * # Features
 *
 * * Use a {@link viewer!Viewer | Viewer} to interactively view a {@link scene!Scene | Scene} in all major browsers, including mobile.
 *
 * * **Pluggable Renderer** - A Viewer has a pluggable {@link viewer!Renderer | Renderer} strategy that adapts the Viewer to use different
 * browser graphics APIs. In this documentation, we'll use a {@link webglrenderer!WebGLRenderer | WebGLRenderer}, which adapts the Viewer to use
 * WebGL for rendering.
 *
 * * **Scene Models** - A Viewer has a {@link scene!Scene | Scene} which holds model geometry and materials. A Scene is a container of
 * {@link scene!SceneModel | SceneModels}, {@link scene!SceneObject | SceneObjects}, {@link scene!SceneMesh | SceneMeshes}
 * and {@link scene!SceneGeometry | SceneGeometries}. It is a data structure that can be built programmatically, as well as loaded and saved
 * as a variety of file formats.
 *
 * * **Full-Precision** - A Viewer can accurately view models that rely on large double-precision World coordinates.
 *
 * * **Multiple Views** - A Viewer can have multiple {@link viewer!View | Views}, each providing an independent view of the Scene in
 * it's own HTML canvas. Each View has its own camera position, projection, lighting, object states (shown, highlighted, X-rayed, colorized..), etc.
 *
 * * **View Layers** - Each View can organize objects in {@link viewer!ViewLayer | ViewLayers}. These allow us to partition our
 * objects into different *bins* depending on what they represent in the View, and then conveniently focus our updates (toggle visibility, select,
 * highlight, slice etc.) on certain bins, exclusively.
 *
 * * **Data Models** - A Viewer can optionally integrate with semantic {@link data!Data | Data}. The Data is an
 * entity-relationship graph that provides an API through users can programmatically construct and search data models. A Data is a container
 * for {@link data!DataModel | DataModels}, {@link data!DataObject | DataObjects}, {@link data!PropertySet | PropertySets}
 * and {@link data!Relationship | Relationships}. Typically, when we want to attach semantic data to a
 * {@link scene!SceneModel | SceneModel}, we would shadow it with a DataModel that has the same ID. For each of the DataModel's SceneObjects that
 we want to attach data to, we would likewise shadow it in the DataModel with a DataObject that has the same ID.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNVU1v4jAQ_SuRT7srQKRAgKjiQqXdA6iI7oe0ysVJpsWtY2cdhy2l_Pd1_JEmkK7KJWbemzdj541zRAlPAYUoobgobgh-EDiLWEoEJJJw5q22EdOY95PAXxDeMWKe-QlgKQgQJlAkwMAs94pZmGUiAEuoUj99NpGInZqKTi_BbI9tEo8fVXWngDMQ2Kwpedi5eGEa3FDMwIYoPoBoFV5VEVfZhO4aeW1kValXoVaDWsJ1SdKODv-UmBJ52OrjOMu-1cTz9D0pSEzBbYQqClhop5rQ23SBZ6EasOuEUy7Ii01MKMlzXOvkJHl6-4dxHDd6WepTdH3AATx7ZJw_mVWZWxnBH80RNdKbh-ZEcl54VkXZpfleb4jQZ-mYFeyoegstF2ytjTT7-hrHhRQ4kYtFg_ML4q-rFrG5t7KQPNvUfbuyGZaCPDd3UVm0RpXvaafhtBnWFVz7gwIWLWdoKc35rzWMljGBE4tLQlP3JwW1W3641L40jsIjZoYwQn6E-v2Ffm7rMewA78xUmkcNfLGAKfIurPdnUbN-V-G8tMKrUGivgmp9AZrcsD6wt5imtLZgucosuYACmCw8wrxv39er-uborKGnN3QXQx2J0HAw-EA7rbNc2pvoopDze-jupwtGc34iZoWa2hvVX16R9t34rZA73omcuz9i9Zxcv_b7Z6MTeiTLKWTVCXYxNz8-RF3z5OkdYvO-WXKm3F2PiP4waCO34NbL8M3LQD2kGBkmqfo26fQIyZ2qEaFQLVO4xyVVPlFqiopLye8OLEHhPaYF9FCZp2ru7OesjkJKJBdr-8GrHj2UY4bCI3pGoT-dD4JgOJv644nvj-ejWQ8dUDgKZoPRfDjxx1fB_Go6np166IVzpTocTILJVGGjSTAMRrPxSMv91qAUJZz-AZsUb1U?type=png)](https://mermaid.live/edit#pako:eNqNVU1v4jAQ_SuRT7srQKRAgKjiQqXdA6iI7oe0ysVJpsWtY2cdhy2l_Pd1_JEmkK7KJWbemzdj541zRAlPAYUoobgobgh-EDiLWEoEJJJw5q22EdOY95PAXxDeMWKe-QlgKQgQJlAkwMAs94pZmGUiAEuoUj99NpGInZqKTi_BbI9tEo8fVXWngDMQ2Kwpedi5eGEa3FDMwIYoPoBoFV5VEVfZhO4aeW1kValXoVaDWsJ1SdKODv-UmBJ52OrjOMu-1cTz9D0pSEzBbYQqClhop5rQ23SBZ6EasOuEUy7Ii01MKMlzXOvkJHl6-4dxHDd6WepTdH3AATx7ZJw_mVWZWxnBH80RNdKbh-ZEcl54VkXZpfleb4jQZ-mYFeyoegstF2ytjTT7-hrHhRQ4kYtFg_ML4q-rFrG5t7KQPNvUfbuyGZaCPDd3UVm0RpXvaafhtBnWFVz7gwIWLWdoKc35rzWMljGBE4tLQlP3JwW1W3641L40jsIjZoYwQn6E-v2Ffm7rMewA78xUmkcNfLGAKfIurPdnUbN-V-G8tMKrUGivgmp9AZrcsD6wt5imtLZgucosuYACmCw8wrxv39er-uborKGnN3QXQx2J0HAw-EA7rbNc2pvoopDze-jupwtGc34iZoWa2hvVX16R9t34rZA73omcuz9i9Zxcv_b7Z6MTeiTLKWTVCXYxNz8-RF3z5OkdYvO-WXKm3F2PiP4waCO34NbL8M3LQD2kGBkmqfo26fQIyZ2qEaFQLVO4xyVVPlFqiopLye8OLEHhPaYF9FCZp2ru7OesjkJKJBdr-8GrHj2UY4bCI3pGoT-dD4JgOJv644nvj-ejWQ8dUDgKZoPRfDjxx1fB_Go6np166IVzpTocTILJVGGjSTAMRrPxSMv91qAUJZz-AZsUb1U)
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * <br>
 *
 * # Usage
 *
 * <br>
 *
 * ## Import NPM Modules
 *
 * Install the NPM modules we need for our usage examples:
 *
 * ````bash
 * npm install @xeokit/scene
 * npm install @xeokit/viewer
 * npm install @xeokit/ktx2
 * npm install @xeokit/webglrenderer
 * npm install @xeokit/constants
 * npm install @xeokit/cameracontrol
 * npm install @xeokit/xgf
 * ````
 *
 *  In JavaScript, import the modules:
 *
 * ````javascript
 * import {Scene} from "@xeokit/sdk/scene";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {KTX2TextureTranscoder} from "@xeokit/sdk/ktx2";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/sdk/constants";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * import {XGFLoader} from "@xeokit/sdk/xgf";
 * ````
 *
 * <br>
 *
 * ## Create a Scene
 *
 * Create a {@link scene!Scene | Scene} to hold our model geometry.
 *
 * > *See [@xeokit/scene](/docs/modules/_xeokit_scene.html)*
 *
 * ````javascript
 * const scene = new Scene();
 * ````
 *
 * <br>
 *
 * ## Create a Viewer
 *
 * Create a {@link viewer!Viewer | Viewer} to view our Scene.
 *
 * Our Viewer gets a {@link webglrenderer!WebGLRenderer | WebGLRenderer}, which adapts it to use the browser's WebGL graphics API.
 * We'll also equip our WebGLRenderer with a {@link ktx2!KTX2TextureTranscoder | KTX2TextureTranscoder} so we that we can view compressed textures.
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderers: new WebGLRenderer({
 *          textureTranscoder: new KTX2TextureTranscoder({  // Optional, this is the default
 *              transcoderPath: "./../dist/basis/" // Optional, defaults to CDN
 *          })
 *      })
 * });
 * ````
 *
 * <br>
 *
 * ## Create a View
 *
 * A Viewer draws its output to one or more {@link viewer!View | Views}. Each View is an independent and interactive view of the Scene,
 * with its own canvas, {@link viewer!Camera | Camera}, object visual states etc.
 *
 * Within our Viewer, we'll create a {@link viewer!View | View} and arrange its Camera:
 *
 * > *See {@xeokit/viewer!View | View}*
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     elementId: "myView1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 * ````
 *
 * <br>
 *
 * ## Add a CameraControl
 *
 * Add a {@link cameracontrol!CameraControl | CameraControl} to the View, to control the View's Camera with mouse and touch input:
 *
 * > *See [@xeokit/cameracontrol](/docs/modules/_xeokit_cameracontrol.html)*
 *
 * ````javascript
 * const myCameraControl = new CameraControl({
 *      view: view1
 * });
 * ````
 *
 * <br>
 *
 * ## Create a SceneModel
 *
 * Our {@link scene!Scene | Scene } is a container for model geometry and materials.
 *
 * Within the Scene, we'll create a {@link scene!SceneModel | SceneModel} that contains a couple
 * of textured {@link scene!SceneModel | SceneObjects}. As soon as we've called {@link scene!SceneModel.build | SceneModel.build}, two
 * new 3D objects appear in the View's canvas.
 *
 * > *See [@xeokit/scene](/docs/modules/_xeokit_scene.html)*
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
 * sceneModel.createLayerMesh({
 *     id: "myMesh1",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createLayerMesh({
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
 * <br>
 *
 * ## Showing and Hiding Objects
 *
 * Having created our Scene, Viewer, View and SceneModel, we now have a couple of objects showing in our View.
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
 * <br>
 *
 * ## Highlighting, Selecting and X-Raying Objects
 *
 * The functions for highlighting, selecting, colorizing and X-raying objects work the same as when hiding and
 * showing them.
 *
 * Let's highlight the first object in our View:
 *
 * ````javascript
 * view1.objects["myObject1"].highlighted = true;
 *
 * view1.highlightMaterial.fillColor=[0,1,0];
 * ````
 *
 * <br>
 *
 * ## Creating Additional Views
 *
 * A Viewer can have an unlimited number of Views, each providing an independent view of the Scene in a separate
 * HTML canvas. Each View can have a completely different viewpoint, projection, and configuration of which objects
 * are visible, x-rayed, highlighted etc.
 *
 * Let's create a second View, with a separate canvas, that shows the other object highlighted instead:
 *
 * ```` javascript
 * const view2 = myViewer.createView({
 *      id: "myView2",
 *      elementId: "myView2"
 * });
 *
 * view2.camera.eye = [-3.933, 2.855, 27.018];
 * view2.camera.look = [4.400, 3.724, 8.899];
 * view2.camera.up = [-0.018, 0.999, 0.039];
 *
 * const myCameraControl2 = new CameraControl({
 *      view: view2
 * });
 *
 * view2.objects["myObject1"].highlighted = true;
 * ````
 *
 * To show an independent view of {@link scene!SceneModel | SceneObjects}, a View
 * proxies them with {@link viewer!ViewObject | ViewObjects}, which represent and control their appearance within the View's canvas.
 *
 * <br>
 *
 * ## Slicing Objects
 *
 * Each View can have an unlimited number of interactive {@link viewer!SectionPlane | SectionPlanes}, with which we can use to slice open objects
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
 * <br>
 *
 * ## Creating ViewLayers
 *
 * Sometimes we want to create SceneModels whose objects will never be included in any BCF viewpoints that we export, and
 * will never be disturbed by any viewpoints that we load.
 *
 * An example of such a case is a skybox, which we'd never want included in any BCF viewpoints, or hidden
 * whenever we load a BCF viewpoint.
 *
 * TODO TODO TODO TODO
 *
 * > *See {@xeokit/viewer!ViewLayer | Viewlayer}*
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
 * ````javascript
 * environmentViewLayer.set
 * ````
 *
 *
 * <br>
 *
 * ## Loading SceneModels
 *
 * > *See [@xeokit/demos](/docs/api/modules/_xeokit_demos.html)*
 *
 * ````javascript
 * const sceneModel2 = scene.createModel({
 *     id: "houseModel"
 * });
 *
 * fetch(`model.bim`)
 *     .then(response => {
 *         response
 *             .json()
 *             .then(fileData => {
 *                 DotBIMLoader({
 *                     fileData,
 *                     sceneModel2
 *                 })
 *                 .then(()=>{
 *                     sceneModel2.build();
 *                 })
 *                 .catch(err => {
 *                     console.error(err);
 *                 });
 *              }).catch(err => {
 *                  console.error(err);
 *              });
 *     }).catch(err => {
 *         console.error(err);
 *     });
 * ````
 *
 * <br>
 *
 * ## Saving SceneModels
 *
 * ````javascript
 * const fileData = DotBIMExporter({
 *      sceneModel
 * });
 * ````
 *
 * <br>
 *
 * ## Canvas Snapshots
 *
 * <br>
 *
 * ## Render Modes
 *
 * Let's configure our View to apply enhanced edges and ambient
 * shadows when in QualityRender mode, and only apply resolution scaling in FastRender mode.
 *
 * ````javascript
 * import {FastRender, QualityRender} from "@xeokit/sdk/constants";
 *
 * myView.edges.renderModes = [QualityRender];
 * myView.sao.renderModes = [QualityRender];
 * myView.resolutionScale.renderModes = [FastRender];
 *````
 *
 * Initially we'll set the View in FastRender mode.
 *
 * ````javascript
 * myView.renderMode = FastRender;
 * ````
 *
 * Now, whenever we want to draw the View with full resoltion, edge enhancement and ambient shadows, we just switch
 * it over to QualityRender mode.
 *
 * ````javascript
 * myView.renderMode = QualityRender;
 * ````
 *
 * Switch it back to FastRender mode whenever we want to enable canvas scaling, and disable edges and ambient shaodows for smoother interaction.
 *
 * ````javascript
 * myView.renderMode = FastRender;
 * ````
 *
 * <br>
 *
 * ## Saving BCF
 *
 * <br>
 *
 * ## Loading BCF
 *
 *
 * TODO
 * Now we can export that View as a BCF viewpoint that will never include our skybox objects:
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
 *      excludeViewLayerIds: ["myEnvironmentViewLayer"]
 * });
 * ````
 *
 *
 * @module viewer
 */
export * from "./Viewer";
export * from "./ViewParams";
export * from "./Renderer";
export * from "./Camera";
export * from "./Projection";
export * from "./FrustumProjection";
export * from "./OrthoProjection";
export * from "./PerspectiveProjection";
export * from "./CustomProjection";
export * from "./scheduler";
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
export * from "./ResolutionScale";
export * from "./Texturing";
export * from "./TickParams";
export * from "./SnapshotParams";
export * from "./SnapshotResult";
//# sourceMappingURL=index.js.map
