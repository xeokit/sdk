/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # xeokit Scene Graph
 *
 * ---
 *
 * **Core scene-graph types and APIs for constructing, inspecting, importing, exporting,
 * and rendering 3D content in xeokit.**
 *
 * ---
 *
 * This module defines xeokit’s primary in-memory **scene graph** model. It provides a
 * structured, extensible representation of 3D content that is designed to work
 * consistently in both browsers and Node.js.
 *
 * <br>
 *
 * ```mermaid
 * classDiagram
 *     Scene "1" *-- "*" SceneModel : models
 *     Scene "1" *-- "1" CoordinateSystem : coordinateSystem
 *     Scene "1" *-- "1" SceneEvents : emits
 *     SceneModel "1" o-- "*" SceneObject : objects
 *     SceneModel "1" *-- "1" CoordinateSystem : coordinateSystem
 *     SceneObject "1" o-- "*" SceneMesh : meshes
 *     SceneMesh "1" o-- "1" SceneGeometry : geometry
 *     SceneMesh "1" o-- "1" SceneMaterial : material
 *     SceneMesh "1" o-- "1" SceneTransform : parentTransform
 *     SceneTransform "1" o-- "1" SceneTransform : parentTransform
 *     SceneMaterial "1" o-- "1" SceneTexture : colorTexture
 *     SceneMaterial "1" o-- "1" SceneTexture : metallicRoughnessTexture
 *     SceneMaterial "1" o-- "1" SceneTexture : occlusionTexture
 *     SceneMaterial "1" o-- "1" SceneTexture : emissiveTexture
 *     Scene:createModel()
 *     SceneModel:createObject()
 *     SceneModel:createGeometry()
 *     SceneModel:createTexture()
 *     SceneModel:createMaterial()
 *     SceneModel:createMesh()
 *     SceneModel:createTransform()
 *     SceneModel:fromParams()
 *     SceneModel:toParams()
 *     SceneModel:destroy()
 *     SceneObject:destroy()
 *     SceneMesh:destroy()
 *     SceneEvents:onError
 *     SceneEvents:onSceneDestroyed
 *     SceneEvents  : onSceneModelCreated
 *     SceneEvents  : onSceneModelDestroyed
 *     SceneEvents  : onSceneObjectCreated
 *     SceneEvents  : onSceneObjectDestroyed
 *     SceneEvents : etc.
 *     SceneGeometry:primitiveType
 *     SceneGeometry:positions
 *     SceneGeometry:indices
 *     SceneGeometry:uvs
 *     Scene:models
 *     Scene:objects
 *     SceneModel:objects
 *     SceneModel:meshes
 *     SceneModel:geometries
 *     SceneModel:textures
 *     SceneModel:materials
 *     SceneMesh:geometry
 *     SceneMesh:material
 *     SceneObject:meshes
 *     SceneMesh:color
 *     SceneMesh:opacity
 *     SceneMesh:matrix
 *     SceneMesh:transform
 *     SceneTransform:matrix
 *     SceneTransform:parentTransform
 *     CoordinateSystem:basis
 *     CoordinateSystem:units
 *     CoordinateSystem:origin
 *     CoordinateSystem:scaleToMeters
 *     Scene "1" *-- "*" SceneObject : objects
 *     SceneModel "1" *-- "*" SceneGeometry : geometries
 *     SceneModel "1" *-- "*" SceneTexture : textures
 *     SceneModel "1" *-- "*" SceneMaterial : materials
 *     SceneModel "1" *-- "*" SceneMesh : meshes
 * ```
 *
 * At its core:
 *
 * - A {@link Scene} is the top-level container and lifecycle manager.
 * - A {@link Scene} owns one or more {@link SceneModel | SceneModels}.
 * - Each {@link SceneModel} groups renderable and logical content, including:
 *   - {@link SceneObject | SceneObjects} (logical entities),
 *   - {@link SceneTransform | SceneTransforms} (hierarchical transforms),
 *   - {@link SceneMesh | SceneMeshes} (renderable instances),
 *   - {@link SceneGeometry | SceneGeometries} (shared vertex/index buffers),
 *   - {@link SceneTexture | SceneTextures} and {@link SceneMaterial | SceneMaterials}.
 *
 * ### Building, Importing and Exporting
 *
 * The scene graph is deliberately **buildable** and **serializable**:
 *
 * - Content can be created programmatically using builder-style APIs.
 * - Models can be imported from and exported to multiple industry formats
 *   (eg. {@link gltf}, {@link las}, {@link cityjson}, {@link xgf}, {@link dotbim}, {@link ifc}).
 * - SceneModels can be serialized to JSON and reconstructed later.
 * - A Scene can be attached to a {@link viewer!Viewer | Viewer} and {@link WebGLRenderer} for interactive
 *   rendering, or used headlessly in Node.js for conversion and processing workflows.
 * - Using the builder APIs, you can create and modify content at runtime, with changes automatically reflected in the attached Viewer and WebGLRenderer.
 *
 * ### Scene Events
 *
 * The {@link SceneEvents} system exposes lifecycle and error events, allowing applications
 * to observe and react to changes as models, objects, and resources are created or destroyed. These events
 * are consumed by components such as {@link Viewer} and {@link WebGLRenderer} to manage rendering and interaction,
 * without the scene needing to be aware of those components.
 *
 * ### Federated Models and Coordinate Systems
 *
 * A Scene uses a {@link CoordinateSystem} to specify its basis, units, origin, and scale. Each
 * {@link SceneModel} can also have its own CoordinateSystem, enabling models from various sources
 * to be combined without prior conversion. The SDK manages coordinate system transformations
 * automatically during rendering and interaction, preserving each model’s original data.
 *
 * ### Geometry Compression
 *
 * The SceneModel supports on-the-fly geometry compression (quantization) when creating geometries from raw vertex/index data. For
 * faster creation, you can pre-compress geometry parameters using {@link compressGeometryParams} and create geometry
 * from those compressed parameters using {@link SceneModel.createGeometryCompressed}.
 *
 * ### Seamless Double-Precision Coordinate and Transform Support
 *
 * The xeokit {@link Scene} and {@link SceneModel} APIs natively support double-precision (64-bit float) coordinates and transforms
 * throughout the scene graph. All transformation matrices are stored as double-precision
 * arrays, allowing accurate placement of models at any scale or distance. Transformations can be nested hierarchically,
 * and dynamically updated at runtime.
 *
 * For rendering, the {@link Viewer} and {@link WebGLRenderer}
 * evaluate all transforms in double-precision on the CPU. To maintain visual accuracy on the GPU (which uses single-precision),
 * the renderer uses camera-relative modeling matrices and a tile-based system: scene objects are grouped into tiles,
 * each with a center and a modified view matrix. Data textures store these per-tile view matrices, which shaders
 * fetch to render multi-tile batches in a single draw call. This approach keeps all GPU positions close to the origin,
 * minimizing floating-point error and supporting massive, real-world scale models.
 *
 * Limitations:
 *
 * - Geometry vertex positions must be single-precision (32-bit) floats.
 * - Avoid double-precision scale transforms - these have potential to cause inaccuracies when very large.
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
 * import { ViewController } from "@xeokit/sdk/viewcontroller";
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
 * - {@link viewcontroller!ViewController | ViewController} (mouse/touch navigation)
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
 * const viewController = new ViewController(view);
 * ```
 *
 * <br>
 *
 * ### 6) Build a SceneModel (a simple “table”)
 *
 * Next we create a {@link SceneModel} and populate it with:
 *
 * - one {@link SceneGeometry} (a box),
 * - one {@link SceneTexture} + {@link SceneMaterial},
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
 * const materialResult = sceneModel.createMaterial({
 *   id: "theMaterial",
 *   colorTextureId: "colorTexture"
 * });
 *
 * if (!materialResult.ok) {
 *   console.error(materialResult.error);
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
 *   materialId: "theMaterial"
 * });
 *
 * sceneModel.addMesh({
 *   id: "greenLegMesh",
 *   geometryId: "boxGeometry",
 *   position: [4, -6, -4],
 *   scale: [1, 3, 1],
 *   rotation: [0, 0, 0],
 *   color: [0.3, 1.0, 0.3],
 *   materialId: "theMaterial"
 * });
 *
 * sceneModel.addMesh({
 *   id: "blueLegMesh",
 *   geometryId: "boxGeometry",
 *   position: [4, -6, 4],
 *   scale: [1, 3, 1],
 *   rotation: [0, 0, 0],
 *   color: [0.3, 0.3, 1.0],
 *   materialId: "theMaterial"
 * });
 *
 * sceneModel.addMesh({
 *   id: "yellowLegMesh",
 *   geometryId: "boxGeometry",
 *   position: [-4, -6, 4],
 *   scale: [1, 3, 1],
 *   rotation: [0, 0, 0],
 *   color: [1.0, 1.0, 0.0],
 *   materialId: "theMaterial"
 * });
 *
 * sceneModel.addMesh({
 *   id: "tableTopMesh",
 *   geometryId: "boxGeometry",
 *   position: [0, -3, 0],
 *   scale: [6, 0.5, 6],
 *   rotation: [0, 0, 0],
 *   color: [1.0, 0.3, 1.0],
 *   materialId: "theMaterial"
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
 * const material    = theSceneModel.materials["theMaterial"];
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
 * ## Using Dynamic Transforms
 *
 * The SceneModel supports dynamic transforms via {@link SceneTransform}. Each {@link SceneMesh} can reference a parent
 * transform, and each {@link SceneTransform} can reference a parent transform, allowing you to build hierarchical
 * transform structures. Transforms support double-precision values, and can be updated at runtime to
 * achieve dynamic animation effects. The Viewer and WebGLRenderer automatically ensure that double-precion transforms
 * are rendered accurately on the GPU, even for huge transforms, as shown in the example below.
 *
 * In this example, we create a mesh, attached to a transform with a large position to demonstrate double-precision support, then we
 * update its rotation over time to make it spin.
 *
 * ```javascript
 * sceneModel.createTransform({
 *   id: "myTransform",
 *   position: [100000000, 0, 0], // Large position to demonstrate double-precision support
 *   scale: [1, 1, 1],
 *   rotation: [0, 0, 0] // X,Y,Z Euler angles in degrees
 * });
 *
 * sceneModel.addMesh({
 *   id: "meshWithTransform",
 *   geometryId: "boxGeometry",
 *   parentTransformId: "myTransform",
 *   color: [1, 0, 0]
 * });
 *
 * const transform = sceneModel.transforms["myTransform"];
 * transform.rotation = [0, performance.now() / 40, 0]; // Rotate around Y axis over time
 * ```
 *
 * <br>
 *
 * ## Exporting a SceneModel to a file
 *
 * SceneModels can be exported to several formats. For example, export to DotBIM with
 * {@link DotBIMExporter} :
 *
 * ```javascript
 * import { DotBIMExporter } from "@xeokit/sdk/formats/dotbim";
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
 * {@link DotBIMLoader}:
 *
 * ```javascript
 * import { DotBIMLoader } from "@xeokit/sdk/formats/dotbim";
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
export * from "./SceneMaterial";
export * from "./SceneGeometry";
export * from "./SceneMesh";

export * from "./CoordinateSystem";
export * from "./CoordinateSystemParams";
export * from "./createCoordinateSystemTransform";
export * from "./getMeshWorldMatrix";

export * from "./SceneMeshParams";
export * from "./SceneObjectParams";
export * from "./SceneTextureParams";
export * from "./SceneMaterialParams";
export * from "./SceneTransform";
export * from "./SceneTransformParams";
export * from "./SceneGeometryCompressedParams";
export * from "./SceneGeometryParams";
export * from "./SceneModelParams";
export * from "./compressGeometryParams";


export * from "./buildMat4"

import type {Viewer} from "../viewer";
import type {WebGLRenderer} from "../webglrenderer";
import type {DotBIMLoader, DotBIMExporter} from "../formats/dotbim";

