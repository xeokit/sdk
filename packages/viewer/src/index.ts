/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/xeokit_viewer_logo.png"/>
 *
 * ## Browser-Based SceneModel Viewer
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
 * Create a {@link @xeokit/viewer!Viewer}, configured with a {@link @xeokit/webgl!WebGLRenderer}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl";
 * import {PerspectiveProjectionType, TrianglesPrimitive} from "@xeokit/core/constants";
 * import {CameraControl} from "@xeokit/controls";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ })
 * });
 * ````
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
 * Add a {@link @xeokit/controls!CameraControl} to the View, to control the Camera from mouse and touch input:
 *
 * ````javascript
 * const myCameraControl = new CameraControl({
 *      view: view1
 * });
 * ````
 *
 * Now, within the Viewer's {@link @xeokit/core/components!Scene | Scene }, build
 * a {@link @xeokit/core/components!SceneModel | SceneModel} that contains a couple of objects:
 *
 * ````javascript
 * const sceneModel = myViewer.scene.createModel({
 *     id: "myModel"
 * });
 *
 * sceneModel.createGeometry({
 *     id: "myGeometry",
 *     primitive: TrianglesPrimitive,
 *     positions: [...],
 *     indices: [...]
 *     //...
 * });
 *
 * sceneModel.createMesh({
 *     id: "myMesh",
 *     geometryId: "myGeometry",
 *     //...
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh"],
 *     viewLayerId: "main"
 *     //...
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh"],
 *     viewLayerId: "main"
 *     //...
 * });
 *
 * sceneModel.build();
 * ````
 *
 * We now have a couple of objects visible in our View's canvas.
 *
 * Highlight one of the objects in the View:
 *
 * ````javascript
 * view1.setObjectsHighlighted(["myObject1"], true);
 * ````
 *
 * Another way to highlight the object:
 *
 * ````javascript
 * view1.objects["myObject1"].highlighted = true;
 * ````
 *
 * ## Creating a Second View
 *
 * Create a second View, using a different canvas, that shows the other object highlighted instead:
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
 * Let's read back some of that {@link @xeokit/core/components!SceneModel | SceneModel} data we created earlier:
 *
 * ```` javascript
 * const texture = sceneModel.textures["myTexture"];
 * const textureSet = sceneModel.textureSets["myTextureSet"];
 *
 * const myGeometry = sceneModel.geometries["myGeometry"];
 * const bucket0 = myGeometry.buckets[0];
 * const bucket0Positions = bucket0.positions;
 * const bucket0Indices = bcket0.indices;
 *
 * const myMesh = sceneModel.meshes["myMesh"];
 * const myGeometryAgain = myMesh.geometry;
 *
 * const myObject1 = sceneModel.objects["myObject1"];
 * const myObject2 = sceneModel.objects["myObject2"];
 *
 * const myMeshAgain = myObject1.mesh;
 *````
 * 
 * ## Slice Objects
 *
 * ````javascript
 * const mySlice1 = view2.createSlice({
 *     id: "mySlice1",
 *     pos: [0,0,0],
 *     dir: [-1,-1,-1]
 * });
 *
 * mySlice.dir = [1,1,1];
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