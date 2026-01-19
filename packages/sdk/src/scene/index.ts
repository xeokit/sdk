/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # xeokit Scene (Buildable 3D Scene Representation)
 *
 * ---
 *
 * **A buildable, viewable, importable, and exportable 3D scene graph that works in both browsers and Node.js.**
 *
 * ---
 *
 * ## Overview
 *
 * The xeokit SDK represents content as a scene graph:
 *
 * - A {@link Scene} is the top-level container.
 * - A {@link Scene} contains one or more {@link SceneModel | SceneModels}.
 * - Each {@link SceneModel} contains:
 *   - {@link SceneObject | SceneObjects} (logical entities),
 *   - {@link SceneMesh | SceneMeshes} (renderable instances),
 *   - {@link SceneGeometry | SceneGeometries} (shared vertex/index data),
 *   - {@link SceneTexture | SceneTextures} and {@link SceneTextureSet | SceneTextureSets}.
 *
 * You can use the Scene graph to:
 *
 * - Build content programmatically (builder methods on {@link Scene} / {@link SceneModel})
 * - Import and export formats such as {@link gltf}, {@link las}, {@link cityjson}, {@link xgf}, {@link dotbim}, and {@link ifc}
 * - Attach a Scene to a {@link viewer!Viewer | Viewer} for interactive rendering in the browser
 * - Serialize/deserialize models to/from JSON
 * - Observe lifecycle events via {@link SceneEvents}
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Quick Start (Tutorial)
 *
 * This tutorial builds a simple “table” model (5 parts), attaches a Viewer, and shows how to read back created components.
 *
 * <br>
 *
 * ### 1) Import the modules you’ll use
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/scene";
 * import {
 *   TrianglesPrimitive,
 *   LinearEncoding,
 *   LinearFilter,
 *   ClampToEdgeWrapping
 * } from "@xeokit/sdk/constants";
 *
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * ```
 *
 * <br>
 *
 * ### 2) Create a Scene
 *
 * ```javascript
 * const scene = new Scene();
 * ```
 *
 * <br>
 *
 * ### 3) Subscribe to Scene lifecycle events (optional)
 *
 * Everything that happens in a {@link Scene} is reported via the {@link SceneEvents} dispatcher at {@link Scene.events}.
 *
 * ```javascript
 * scene.events.onError.subscribe((scene, sdkResult) => {
 *   console.error(`Scene error: ${sdkResult.error}`);
 * });
 *
 * scene.events.onSceneModelCreated.subscribe((scene, sceneModel) => {
 *   console.log(`SceneModel created: ${sceneModel.id}`);
 * });
 *
 * scene.events.onSceneObjectCreated.subscribe((scene, sceneObject) => {
 *   console.log(`SceneObject created: ${sceneObject.id}`);
 * });
 * ```
 *
 * <br>
 *
 * ### 4) Configure the Scene coordinate system (optional)
 *
 * The Scene coordinate system is configured via {@link Scene.coordinateSystem}. By default, the Scene uses a
 * right-handed Z-Up coordinate system.
 *
 * Each {@link SceneModel} may also specify its own {@link SceneModel.coordinateSystem}, allowing you to mix models
 * that originate in different coordinate systems without pre-processing them into a single common basis.
 *
 * Example: set the Scene to a left-handed, Y-Up basis:
 *
 * ```javascript
 * scene.coordinateSystem.basis = [ // +Y-up left-handed
 *   1, 0, 0,  // Right
 *   0, 1, 0,  // Up
 *   0, 0, -1  // Forward
 * ];
 *
 * scene.coordinateSystem.units = "meters";
 * scene.coordinateSystem.origin = [0, 0, 0];
 * scene.coordinateSystem.scaleToMeters = 1.0;
 * ```
 *
 * <br>
 *
 * ### 5) Attach a Viewer (browser only)
 *
 * A {@link Scene} is renderer-agnostic. In Node.js you typically build/convert/export without rendering.
 * In the browser, attach the Scene to a {@link viewer!Viewer | Viewer} and {@link webglrenderer!WebGLRenderer | WebGLRenderer}.
 *
 * A minimal setup uses:
 *
 * - {@link webglrenderer!WebGLRenderer | WebGLRenderer} (WebGL rendering)
 * - {@link viewer!View | View} (a canvas target)
 * - {@link cameracontrol!CameraControl | CameraControl} (mouse/touch navigation)
 *
 * ```javascript
 * const viewer = new Viewer({ scene });
 *
 * const webglRenderer = new WebGLRenderer({ viewer });
 *
 * const viewResult = viewer.createView({
 *   id: "myView",
 *   elementId: "myView1"
 * });
 *
 * if (!viewResult.ok) {
 *   console.error(viewResult.error);
 *   // ..handle error
 * }
 *
 * const view = viewResult.value;
 *
 * view.camera.eye  = [0, 0, -100];
 * view.camera.look = [0, 0, 0];
 * view.camera.up   = [0, 1, 0];
 *
 * const cameraControl = new CameraControl(view);
 * ```
 *
 * <br>
 *
 * ### 6) Build a SceneModel (a simple “table”)
 *
 * Next we create a {@link SceneModel} and populate it with:
 *
 * - one {@link SceneGeometry} (a box),
 * - one {@link SceneTexture} + {@link SceneTextureSet},
 * - five {@link SceneMesh | SceneMeshes} (legs + tabletop),
 * - five {@link SceneObject | SceneObjects} (logical parts referencing meshes).
 *
 * We’ll also set a local coordinate system for this SceneModel (optional).
 *
 * ```javascript
 * const sceneModelResult = scene.createModel({
 *   id: "theModel",
 *
 *   // Optional: coordinate system for this SceneModel
 *   coordinateSystem: {
 *     basis: [ // +Y-up right-handed
 *       1, 0, 0,  // Right
 *       0, 1, 0,  // Up
 *       0, 0, -1  // Forward
 *     ],
 *     units: "centimeters",
 *     origin: [0, 0, 0],
 *     scaleToMeters: 0.01
 *   }
 * });
 *
 * if (!sceneModelResult.ok) {
 *   console.error(sceneModelResult.error);
 *   // ..handle error
 * }
 *
 * const sceneModel = sceneModelResult.value;
 *
 * // 1) Create shared geometry (a box)
 * const geometryResult = sceneModel.createGeometry({
 *   id: "boxGeometry",
 *   primitive: TrianglesPrimitive,
 *   positions: [
 *     1, 1, 1,  -1, 1, 1,
 *     -1, -1, 1,  1, -1, 1,
 *     1, 1, -1,  -1, 1, -1,
 *     -1, -1, -1, 1, -1, -1
 *   ],
 *   indices: [
 *     0, 1, 2, 0, 2, 3,     // +Z
 *     4, 0, 3, 4, 3, 7,     // +X
 *     5, 4, 7, 5, 7, 6,     // -Z
 *     1, 5, 6, 1, 6, 2,     // -X
 *     4, 5, 1, 4, 1, 0,     // +Y
 *     3, 2, 6, 3, 6, 7      // -Y
 *   ]
 * });
 *
 * if (!geometryResult.ok) {
 *   console.error(geometryResult.error);
 *   // ..handle error
 * }
 *
 * // 2) Create a texture and a texture set
 * const textureResult = sceneModel.createTexture({
 *   id: "colorTexture",
 *   src: "./assets/sample_etc1s.ktx2",
 *   preloadColor: [1, 0, 0, 1],
 *   flipY: false,
 *   encoding: LinearEncoding,
 *   magFilter: LinearFilter,
 *   minFilter: LinearFilter,
 *   wrapR: ClampToEdgeWrapping,
 *   wrapS: ClampToEdgeWrapping,
 *   wrapT: ClampToEdgeWrapping
 * });
 *
 * if (!textureResult.ok) {
 *   console.error(textureResult.error);
 *   // ..handle error
 * }
 *
 * const textureSetResult = sceneModel.createTextureSet({
 *   id: "theTextureSet",
 *   colorTextureId: "colorTexture"
 * });
 *
 * if (!textureSetResult.ok) {
 *   console.error(textureSetResult.error);
 *   // ..handle error
 * }
 *
 * // 3) Create meshes (instances of the shared box geometry)
 * sceneModel.addMesh({
 *   id: "redLegMesh",
 *   geometryId: "boxGeometry",
 *   position: [-4, -6, -4],
 *   scale: [1, 3, 1],
 *   rotation: [0, 0, 0],
 *   color: [1, 0.3, 0.3],
 *   textureSetId: "theTextureSet"
 * });
 *
 * sceneModel.addMesh({
 *   id: "greenLegMesh",
 *   geometryId: "boxGeometry",
 *   position: [4, -6, -4],
 *   scale: [1, 3, 1],
 *   rotation: [0, 0, 0],
 *   color: [0.3, 1.0, 0.3],
 *   textureSetId: "theTextureSet"
 * });
 *
 * sceneModel.addMesh({
 *   id: "blueLegMesh",
 *   geometryId: "boxGeometry",
 *   position: [4, -6, 4],
 *   scale: [1, 3, 1],
 *   rotation: [0, 0, 0],
 *   color: [0.3, 0.3, 1.0],
 *   textureSetId: "theTextureSet"
 * });
 *
 * sceneModel.addMesh({
 *   id: "yellowLegMesh",
 *   geometryId: "boxGeometry",
 *   position: [-4, -6, 4],
 *   scale: [1, 3, 1],
 *   rotation: [0, 0, 0],
 *   color: [1.0, 1.0, 0.0],
 *   textureSetId: "theTextureSet"
 * });
 *
 * sceneModel.addMesh({
 *   id: "tableTopMesh",
 *   geometryId: "boxGeometry",
 *   position: [0, -3, 0],
 *   scale: [6, 0.5, 6],
 *   rotation: [0, 0, 0],
 *   color: [1.0, 0.3, 1.0],
 *   textureSetId: "theTextureSet"
 * });
 *
 * // 4) Create objects (logical entities). Each SceneObject references one or more meshes.
 * sceneModel.createObject({ id: "redLegObject",    meshIds: ["redLegMesh"] });
 * sceneModel.createObject({ id: "greenLegObject",  meshIds: ["greenLegMesh"] });
 * sceneModel.createObject({ id: "blueLegObject",   meshIds: ["blueLegMesh"] });
 * sceneModel.createObject({ id: "yellowLegObject", meshIds: ["yellowLegMesh"] });
 * sceneModel.createObject({ id: "tableTopObject",  meshIds: ["tableTopMesh"] });
 *
 * // SceneModel is now ready for use (rendering, picking, exporting, etc).
 * ```
 *
 * <br>
 *
 * ### 7) Read back components you created
 *
 * The SceneModel stores its components in dictionaries keyed by ID.
 * Note: the Scene also indexes objects globally by ID, so you can access an object through either the model or the scene.
 *
 * ```javascript
 * const theSceneModel = scene.models["theModel"];
 *
 * const colorTexture  = theSceneModel.textures["colorTexture"];
 * const textureSet    = theSceneModel.textureSets["theTextureSet"];
 * const boxGeometry   = theSceneModel.geometries["boxGeometry"];
 *
 * const tableTopMesh  = theSceneModel.meshes["tableTopMesh"];
 * const tableTopObj1  = theSceneModel.objects["tableTopObject"];
 * const tableTopObj2  = scene.objects["tableTopObject"];
 * ```
 *
 * <br>
 *
 * ## Using Compressed Geometry
 *
 * When you create a {@link SceneGeometry} via {@link SceneModel.createGeometry}, the SDK may perform on-the-fly
 * processing and compression of geometry parameters.
 *
 * If you want faster SceneModel creation (or you already have geometry data offline), you can pre-compress
 * parameters using {@link compressGeometryParams}, then create geometry from those compressed parameters using
 * {@link SceneModel.createGeometryCompressed}.
 *
 * In the example below, {@link compressGeometryParams} converts {@link SceneGeometryParams} into
 * {@link SceneGeometryCompressedParams}:
 *
 * ```javascript
 * import { compressGeometryParams } from "@xeokit/sdk/compression";
 * import { TrianglesPrimitive } from "@xeokit/sdk/constants";
 *
 * const geometryCompressedParams = compressGeometryParams({
 *   id: "boxGeometry",
 *   primitive: TrianglesPrimitive,
 *   positions: [
 *     1, 1, 1,  -1, 1, 1,
 *     -1, -1, 1,  1, -1, 1,
 *     1, 1, -1,  -1, 1, -1,
 *     -1, -1, -1, 1, -1, -1
 *   ],
 *   indices: [
 *     0, 1, 2, 0, 2, 3,
 *     4, 0, 3, 4, 3, 7,
 *     5, 4, 7, 5, 7, 6,
 *     1, 5, 6, 1, 6, 2,
 *     4, 5, 1, 4, 1, 0,
 *     3, 2, 6, 3, 6, 7
 *   ]
 * });
 * ```
 *
 * A {@link SceneGeometryCompressedParams} typically includes:
 *
 * - Vertex positions quantized to 16-bit integers
 * - Edge indices (when applicable, e.g. for {@link TrianglesPrimitive})
 * - A quantization range (`aabb`) used to de-quantize in the Viewer
 *
 * Create geometry from the compressed parameters:
 *
 * ```javascript
 * const geometryResult2 = sceneModel.createGeometryCompressed(geometryCompressedParams);
 *
 * if (!geometryResult2.ok) {
 *   console.error(geometryResult2.error);
 * }
 * ```
 *
 * <br>
 *
 * ## Exporting a SceneModel to a file
 *
 * SceneModels can be exported to several formats. For example, export to DotBIM with
 * {@link dotbim!DotBIMExporter | DotBIMExporter}:
 *
 * ```javascript
 * import { DotBIMExporter } from "@xeokit/sdk/dotbim";
 *
 * const exporter = new DotBIMExporter();
 *
 * exporter.write({
 *   sceneModel,
 *   dataModel,
 *   version: "1.1.0" // Optional; defaults to the latest supported version
 * }).then(fileData => {
 *   // Use fileData as needed
 * }).catch(err => {
 *   console.error(err);
 * });
 * ```
 *
 * <br>
 *
 * ## Importing a SceneModel from a file
 *
 * Import SceneModels from several formats. For example, load DotBIM using
 * {@link dotbim!DotBIMLoader | DotBIMLoader}:
 *
 * ```javascript
 * import { DotBIMLoader } from "@xeokit/sdk/dotbim";
 *
 * const sceneModelResult2 = scene.createModel({ id: "mySceneModel2" });
 *
 * if (!sceneModelResult2.ok) {
 *   console.error(sceneModelResult2.error);
 *   // ..handle error
 * }
 *
 * const sceneModel2 = sceneModelResult2.value;
 * const dotBIMLoader = new DotBIMLoader();
 *
 * fetch("model.bim")
 *   .then(response => response.json())
 *   .then(fileData => {
 *     return dotBIMLoader.load({ fileData, sceneModel: sceneModel2 });
 *   })
 *   .then(() => {
 *     // Loaded
 *   })
 *   .catch(err => {
 *     sceneModel2.destroy();
 *     console.error(`Error loading .BIM: ${err}`);
 *   });
 * ```
 *
 * <br>
 *
 * ## Serializing a SceneModel to JSON
 *
 * ```javascript
 * const toParamsResult = sceneModel2.toParams();
 *
 * if (!toParamsResult.ok) {
 *   console.error(toParamsResult.error);
 *   // ..handle error
 * }
 *
 * const sceneModelParams = toParamsResult.value;
 * ```
 *
 * <br>
 *
 * ## Deserializing a SceneModel from JSON
 *
 * ```javascript
 * const sceneModelResult3 = scene.createModel({ id: "mySceneModel3" });
 *
 * if (!sceneModelResult3.ok) {
 *   console.error(sceneModelResult3.error);
 *   // ..handle error
 * }
 *
 * const sceneModel3 = sceneModelResult3.value;
 *
 * const fromParamsResult = sceneModel3.fromParams(sceneModelParams);
 *
 * if (!fromParamsResult.ok) {
 *   console.error(fromParamsResult.error);
 * }
 * ```
 *
 * <br>
 *
 * ## Destroying a SceneModel
 *
 * ```javascript
 * sceneModel3.destroy();
 * ```
 *
 * @module scene
 */



export * from "./SceneParams";
export * from "./Scene";
export * from "./SceneEvents";
export * from "./SceneModel";
export * from "./SceneModelParams";
export * from "./SceneModelStats";
export * from "./SceneObject";
export * from "./SceneTexture";
export * from "./SceneTextureSet";
export * from "./SceneGeometry";
export * from "./SceneMesh";

export * from "./CoordinateSystem";
export * from "./CoordinateSystemParams";
export * from "./createCoordinateSystemTransform";

export * from "./SceneMeshParams";
export * from "./SceneObjectParams";
export * from "./SceneTextureParams";
export * from "./SceneTextureSetParams";
export * from "./SceneGeometryCompressedParams";
export * from "./SceneGeometryParams";
export * from "./SceneModelParams";
export * from "./compressGeometryParams";


export * from "./buildMat4"

export * from "./SceneModelParamsLoader";
export * from "./SceneModelParamsExporter";
