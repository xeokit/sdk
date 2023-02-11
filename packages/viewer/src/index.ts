/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/xeokit_viewer_logo.png"/>
 *
 * ## Browser-Based Model Viewer
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
 * Create a {@link @xeokit/viewer!Viewer} with a {@link @xeokit/webgl!WebGLRenderer}:
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
 * Create a {@link @xeokit/viewer!View} with its own {@link @xeokit/viewer!Camera}  and HTML canvas:
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
 * Add a {@link @xeokit/controls!CameraControl} to control the View's Camera with mouse and touch input:
 *
 * ````javascript
 * const myCameraControl = new CameraControl({
 *      view: view1
 * });
 * ````
 *
 * Now build a {@link @xeokit/viewer!ViewerModel | ViewerModel} containing a couple of {@link @xeokit/viewer!ViewObject | ViewObjects}:
 *
 * ````javascript
 * const myViewerModel = myViewer.createModel({
 *     id: "myModel"
 * });
 *
 * myViewerModel.createGeometry({
 *     id: "myGeometry",
 *     primitive: TrianglesPrimitive,
 *     positions: [...],
 *     indices: [...]
 *     //...
 * });
 *
 * myViewerModel.createMesh({
 *     id: "myMesh",
 *     geometryId: "myGeometry",
 *     //...
 * });
 *
 * myViewerModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh"],
 *     viewLayerId: "main"
 *     //...
 * });
 *
 * myViewerModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh"],
 *     viewLayerId: "main"
 *     //...
 * });
 *
 * myViewerModel.build();
 * ````
 *
 * Highlight one of the {@link ViewObject | ViewObjects} in the {@link @xeokit/viewer!View}:
 *
 * ````javascript
 * view1.setObjectsHighlighted(["myObject1"], true);
 * ````
 *
 * Another way to highlight the {@link ViewObject}:
 *
 * ````javascript
 * view1.objects["myObject1"].highlighted = true;
 * ````
 *
 * ## Creating a Second View
 *
 * Create a second view, using a different canvas, that shows the other object highlighted instead:
 *
 * ```` javascript
 * const view2 = myViewer.createView({
 *      id: "myView2",
 *      canvasId: "myView2"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * view1.setObjectsHighlighted(["myObject2"], true);
 * ````
 * @packageDocumentation
 * @module @xeokit/viewer
 */


export * from "./Viewer";
export * from "./ViewParams";
export * from "./ViewerModel";
export * from "./ViewerModelParams";
export * from "./ViewerObject";
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