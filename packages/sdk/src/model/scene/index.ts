/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # Scene Graph
 *
 * 📄 **[Cheatsheet — model/scene at a glance](https://xeokit.github.io/sdk/docs/assets/cheatsheets/model_scene.png)**
 *
 * The scene module stores 3D model content: geometry, textures, materials,
 * meshes, objects and transforms. It does not render by itself. Rendering is done
 * by attaching a {@link viewing!viewer.Viewer | Viewer} and renderer such as
 * {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer}.
 *
 * A {@link Scene} owns one or more {@link SceneModel | SceneModels}. A SceneModel
 * contains shared resources ({@link SceneGeometry | geometries},
 * {@link SceneMaterial | materials}, {@link SceneTexture | textures}) and instances
 * ({@link SceneMesh | meshes}, {@link SceneObject | objects},
 * {@link SceneTransform | transforms}).
 *
 * ## Structure
 *
 * ```mermaid
 * classDiagram
 *     Scene "1" *-- "*" SceneModel : models
 *     Scene "1" *-- "1" CoordinateSystem : coordinateSystem
 *     Scene "1" *-- "1" SceneEvents : emits
 *     Scene "1" *-- "*" SceneObject : objects
 *     SceneModel "1" *-- "1" CoordinateSystem : coordinateSystem
 *     SceneModel "1" *-- "*" SceneGeometry : geometries
 *     SceneModel "1" *-- "*" SceneTexture : textures
 *     SceneModel "1" *-- "*" SceneMaterial : materials
 *     SceneModel "1" *-- "*" SceneMesh : meshes
 *     SceneModel "1" o-- "*" SceneObject : objects
 *     SceneObject "1" o-- "*" SceneMesh : meshes
 *     SceneMesh "1" o-- "1" SceneGeometry : geometry
 *     SceneMesh "1" o-- "1" SceneMaterial : material
 *     SceneMesh "1" o-- "1" SceneTransform : parentTransform
 *     SceneTransform "1" o-- "1" SceneTransform : parentTransform
 *     SceneMaterial "1" o-- "1" SceneTexture : colorTexture
 *     Scene:createModel()
 *     SceneModel:createGeometry()
 *     SceneModel:createMaterial()
 *     SceneModel:createMesh()
 *     SceneModel:createObject()
 *     SceneModel:createTransform()
 *     SceneModel:toParams()
 *     SceneModel:fromParams()
 * ```
 *
 * Main types:
 *
 * - {@link Scene} — root container and global object index.
 * - {@link SceneModel} — owns the resources and objects for one model.
 * - {@link SceneObject} — logical object, usually one picked/selectable thing.
 * - {@link SceneMesh} — renderable instance of geometry with material, transform and per-mesh state.
 * - {@link SceneGeometry} — vertex and index data.
 * - {@link SceneMaterial} and {@link SceneTexture} — visual appearance.
 * - {@link SceneTransform} — reusable hierarchical transform.
 * - {@link CoordinateSystem} — basis, units, origin and scale.
 * - {@link SceneEvents} — lifecycle and error events.
 *
 * ## Coordinate Systems
 *
 * A {@link Scene} has a {@link CoordinateSystem}. Each {@link SceneModel} can also
 * define one. This lets one Scene contain models whose source data uses different
 * bases, units or origins.
 *
 * ```ts
 * scene.coordinateSystem.basis = [
 *   1, 0, 0,
 *   0, 1, 0,
 *   0, 0, -1,
 * ];
 * scene.coordinateSystem.units = "meters";
 * scene.coordinateSystem.origin = [0, 0, 0];
 * scene.coordinateSystem.scaleToMeters = 1.0;
 * ```
 *
 * Scene and SceneModel transforms use double-precision arrays on the CPU. Geometry
 * vertex arrays are single-precision. The WebGL renderer handles large world
 * coordinates with camera-relative matrices and tiled batches.
 *
 * ## Creating a SceneModel
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { TrianglesPrimitive } from "@xeokit/sdk/base/constants";
 *
 * const scene = new Scene();
 *
 * const modelRes = scene.createModel({ id: "table" });
 * if (!modelRes.ok) throw new Error(modelRes.error);
 * const model = modelRes.value;
 *
 * model.createGeometry({
 *   id: "boxGeometry",
 *   primitive: TrianglesPrimitive,
 *   positions: [
 *     1, 1, 1, -1, 1, 1,
 *     -1, -1, 1, 1, -1, 1,
 *     1, 1, -1, -1, 1, -1,
 *     -1, -1, -1, 1, -1, -1,
 *   ],
 *   indices: [
 *     0, 1, 2, 0, 2, 3,
 *     4, 0, 3, 4, 3, 7,
 *     5, 4, 7, 5, 7, 6,
 *     1, 5, 6, 1, 6, 2,
 *     4, 5, 1, 4, 1, 0,
 *     3, 2, 6, 3, 6, 7,
 *   ],
 * });
 *
 * model.createMaterial({ id: "red", color: [1, 0, 0] });
 *
 * model.addMesh({
 *   id: "legMesh",
 *   geometryId: "boxGeometry",
 *   materialId: "red",
 *   position: [0, -3, 0],
 *   scale: [1, 3, 1],
 * });
 *
 * model.createObject({ id: "legObject", meshIds: ["legMesh"] });
 * ```
 *
 * Components are indexed by id:
 *
 * ```ts
 * const tableModel = scene.models["table"];
 * const mesh = tableModel.meshes["legMesh"];
 * const objectFromModel = tableModel.objects["legObject"];
 * const objectFromScene = scene.objects["legObject"];
 * ```
 *
 * ## Lifecycle and Memory Policy
 *
 * A SceneModel can describe both how it will be built and how tightly renderers
 * should allocate backing storage.
 *
 * ```ts
 * const model = scene.createModel({
 *   id: "hospital",
 *   updateHint: "static",
 *   lifecycle: "streaming",
 *   memoryPolicy: "compact",
 * }).value;
 * ```
 *
 * {@link SceneModelParams.updateHint | updateHint} describes expected
 * renderer-facing value upload cadence:
 *
 * - `"auto"` lets a renderer choose.
 * - `"static"` is for models whose matrices, transforms, colors and object
 *   state are mostly stable while they are drawn many times.
 * - `"dynamic"` is for models that frequently upload matrices, transforms,
 *   colors or object state.
 *
 * {@link SceneModelParams.lifecycle | lifecycle} describes construction:
 *
 * - `"open"` allows ordinary ad-hoc component creation.
 * - `"streaming"` allows incremental chunks or batches to arrive over time.
 * - `"sealed"` closes the model to new topology after initial creation.
 *
 * {@link SceneModelParams.memoryPolicy | memoryPolicy} is a renderer allocation
 * hint. It does not change the SceneModel's public data and is not a hard heap
 * limit. It tells renderers whether to use reusable backing stores or tightly
 * sized storage such as VBOs, data textures and renderer-side batch tables:
 *
 * - `"stream"` is the default for open, streaming or editable content.
 *   Renderers may use their normal growable/reusable allocation strategy.
 * - `"compact"` is for finalized content. Renderers should avoid avoidable
 *   slack when allocating sealed models or committed batches.
 *
 * Use {@link SceneModel.seal | seal} when a model is complete and should reject
 * further topology/resource growth:
 *
 * ```ts
 * model.createGeometry({ id: "g", primitive, positions, indices });
 * model.createMesh({ id: "m", geometryId: "g" });
 * model.createObject({ id: "o", meshIds: ["m"] });
 *
 * const sealRes = model.seal();
 * if (!sealRes.ok) throw new Error(sealRes.error);
 * ```
 *
 * For progressive loading, use batches to stage a chunk and then publish it as a
 * unit. Viewers and renderers can defer partial batch content until commit.
 * The XGF stream loader uses this pattern for manifest chunks: each loaded XGF
 * stream chunk with a manifest ID or URI is wrapped in a SceneModel batch whose
 * ID is the chunk key, then committed only after the chunk has parsed
 * successfully. This exposes chunk boundaries without forcing a renderer to
 * allocate one GPU batch per stream chunk.
 *
 * ```ts
 * const batchRes = model.beginBatch({ id: "tile-42" });
 * if (!batchRes.ok) throw new Error(batchRes.error);
 *
 * model.createGeometry({ id: "tile-42:g", primitive, positions, indices });
 * model.createMesh({ id: "tile-42:m", geometryId: "tile-42:g" });
 * model.createObject({ id: "tile-42:o", meshIds: ["tile-42:m"] });
 *
 * const commitRes = model.commitBatch();
 * if (!commitRes.ok) throw new Error(commitRes.error);
 * ```
 *
 * ## Rendering
 *
 * Browser rendering is optional. A minimal setup uses a Scene, Viewer,
 * WebGLRenderer, View and ViewController:
 *
 * ```ts
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
 *
 * const viewer = new Viewer({ scene });
 * new WebGLRenderer({ viewer });
 *
 * const viewRes = viewer.createView({ id: "main", elementId: "canvas" });
 * if (!viewRes.ok) throw new Error(viewRes.error);
 *
 * const view = viewRes.value;
 * view.camera.eye = [0, 0, -100];
 * view.camera.look = [0, 0, 0];
 * view.camera.up = [0, 1, 0];
 *
 * new ViewController(view, {});
 * ```
 *
 * ## Compressed Geometry
 *
 * Use {@link compressGeometryParams} when geometry has already been prepared for
 * compact storage or faster SceneModel creation.
 *
 * ```ts
 * import { compressGeometryParams } from "@xeokit/sdk/model/scene";
 * import { TrianglesPrimitive } from "@xeokit/sdk/base/constants";
 *
 * const compressed = compressGeometryParams({
 *   id: "boxGeometry",
 *   primitive: TrianglesPrimitive,
 *   positions,
 *   indices,
 * });
 *
 * model.createGeometryCompressed(compressed);
 * ```
 *
 * ## Dynamic Transforms
 *
 * Meshes can reference {@link SceneTransform | SceneTransforms}. Transforms can
 * be nested and updated after creation.
 *
 * ```ts
 * model.createTransform({
 *   id: "moving",
 *   position: [100000000, 0, 0],
 *   rotation: [0, 0, 0],
 *   scale: [1, 1, 1],
 * });
 *
 * model.addMesh({
 *   id: "movingMesh",
 *   geometryId: "boxGeometry",
 *   parentTransformId: "moving",
 *   color: [1, 0, 0],
 * });
 *
 * model.transforms["moving"].rotation = [0, performance.now() / 40, 0];
 * ```
 *
 * ## Serialization
 *
 * ```ts
 * const paramsRes = model.toParams();
 * if (!paramsRes.ok) throw new Error(paramsRes.error);
 *
 * const restoredRes = scene.createModel({ id: "restored" });
 * if (!restoredRes.ok) throw new Error(restoredRes.error);
 *
 * restoredRes.value.fromParams(paramsRes.value);
 * ```
 *
 * ## Import and Export
 *
 * Format modules can load into, or export from, a SceneModel. For example, DotBIM:
 *
 * ```ts
 * import { DotBIMLoader, DotBIMExporter } from "@xeokit/sdk/formats/dotbim";
 *
 * const loadedRes = scene.createModel({ id: "loaded" });
 * if (!loadedRes.ok) throw new Error(loadedRes.error);
 *
 * const fileData = await fetch("model.bim").then(r => r.json());
 * await new DotBIMLoader().load({ fileData, sceneModel: loadedRes.value });
 *
 * const exported = await new DotBIMExporter().write({
 *   sceneModel: loadedRes.value,
 * });
 * ```
 *
 * ## Events and Lifecycle
 *
 * ```ts
 * scene.events.onSceneModelCreated.subscribe((scene, sceneModel) => {
 *   console.log("SceneModel created: " + sceneModel.id);
 * });
 *
 * scene.events.onError.subscribe((scene, error) => {
 *   console.error(error.error);
 * });
 *
 * model.destroy();
 * scene.destroy();
 * ```
 *
 * @module scene
 */
export * from "./SceneParams";
export * from "./Scene";
export * from "./SceneEvents";
export * from "./SceneModel";
export * from "./SceneModelBatch";
export * from "./SceneModelParams";
export * from "./isDefaultLayer";
export * from "./SceneModelStats";
export * from "./SceneObject";
export * from "./SceneTexture";
export * from "./SceneMaterial";
export * from "./SceneTechnique";
export * from "./ThickLinesTechnique";
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
export * from "./SceneTechniqueParams";
export * from "./SceneTransform";
export * from "./SceneTransformParams";
export * from "./SceneGeometryCompressedParams";
export * from "./SceneGeometryParams";
export * from "./SceneModelParams";
export * from "./compressGeometryParams";


export * from "./buildMat4"

export * from "./linePattern";

export * from "./hatchPattern";

import type {Viewer} from "../../viewing/viewer";
import type {DotBIMLoader, DotBIMExporter} from "../../formats/dotbim";
