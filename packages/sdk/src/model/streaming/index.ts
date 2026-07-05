/**
 * <img style="padding:50px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_datamodel_icon.png"/>
 *
 * # xeokit Streaming Loader
 *
 * ---
 *
 * **Batch-loads multi-part models from a JSON manifest into a
 * {@link model!scene.SceneModel | SceneModel} and an optional
 * {@link model!data.DataModel | DataModel}, chunk by chunk.**
 *
 * ---
 *
 * Large BIM and CAD models routinely exceed any sensible single-file
 * limit — splitting them into geometry chunks (typically XGF) plus
 * matching semantic chunks (DataModel JSON) is the standard
 * delivery shape. `ModelChunksLoader` walks a manifest of those
 * chunks and applies the configured per-chunk loaders, populating
 * one SceneModel + DataModel pair end-to-end with no caller-side
 * orchestration.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class ModelChunksLoader {
 *       +sceneModelLoader : ModelLoader
 *       +dataModelLoader? : ModelLoader
 *       +load(params)
 *     }
 *     class ModelChunksLoaderParams {
 *       +sceneModelLoader : ModelLoader
 *       +dataModelLoader? : ModelLoader
 *     }
 *     class ModelChunksManifestParams {
 *       +sceneModelMIMEType : string
 *       +sceneModelFiles    : string[]
 *       +dataModelFiles?    : string[]
 *     }
 *     class LoadModelChunksParams {
 *       +modelChunksManifest : ModelChunksManifestParams
 *       +baseDir             : string
 *       +sceneModel          : SceneModel
 *       +dataModel?          : DataModel
 *     }
 *     class SceneModel {
 *       <<scene>>
 *     }
 *     class DataModel {
 *       <<data>>
 *     }
 *     ModelChunksLoader ..> ModelChunksLoaderParams : constructor
 *     ModelChunksLoader ..> LoadModelChunksParams : load
 *     LoadModelChunksParams o-- ModelChunksManifestParams
 *     LoadModelChunksParams o-- SceneModel : writes
 *     LoadModelChunksParams o-- DataModel : writes
 * ```
 *
 * <br>
 *
 * ## Manifest shape
 *
 * The manifest is a small JSON file pairing geometry chunks with
 * the matching semantic chunks:
 *
 * ```json
 * {
 *     "sceneModelMIMEType": "arraybuffer",
 *     "sceneModelFiles": [
 *         "model.xgf",
 *         "model2.xgf",
 *         "model3.xgf"
 *     ],
 *     "dataModelFiles": [
 *         "model.json",
 *         "model2.json",
 *         "model3.json"
 *     ]
 * }
 * ```
 *
 * - `sceneModelFiles` lists the geometry chunks (XGF, glTF, …).
 * - `dataModelFiles` (optional) lists matching DataModel JSON chunks.
 * - `sceneModelMIMEType` chooses how chunks are fetched
 *   (`"arraybuffer"` for binary, `"json"` for text).
 *
 * <br>
 *
 * ## Features
 *
 * - **One call loads the whole model** — pass the manifest, the
 *   `baseDir`, the target SceneModel + DataModel, and the loader
 *   walks every chunk in parallel.
 * - **Pluggable per-chunk loaders** — pass an
 *   {@link formats!XGFLoader | XGFLoader} for geometry,
 *   {@link formats!datamodel.DataModelImporter | DataModelImporter}
 *   for semantics, or any other loader that implements
 *   {@link formats!ModelLoader | ModelLoader}.
 * - **Geometry + semantics in lockstep** — chunks share an ordering
 *   so the loader emits {@link model!scene.SceneObject | SceneObjects}
 *   and {@link model!data.DataObject | DataObjects} with matching
 *   ids; picking and inspection see one coherent graph at the end.
 * - **Returns when everything's done** — single Promise resolution
 *   when every chunk has reached its target model.
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
 * ## Quick Start
 *
 * ### 1) Import the entry point
 *
 * ```javascript
 * import { ModelChunksLoader } from "@xeokit/sdk/model/streaming";
 * import { XGFLoader }         from "@xeokit/sdk/formats/xgf";
 * import { DataModelImporter } from "@xeokit/sdk/formats/datamodel";
 * ```
 *
 * <br>
 *
 * ### 2) Construct with per-chunk loaders
 *
 * ```javascript
 * const modelChunksLoader = new ModelChunksLoader({
 *   sceneModelLoader: new XGFLoader(),
 *   dataModelLoader:  new DataModelImporter()
 * });
 * ```
 *
 * <br>
 *
 * ### 3) Load a manifest
 *
 * ```javascript
 * const manifest = await fetch("modelChunksManifest.json").then(r => r.json());
 *
 * await modelChunksLoader.load({
 *   modelChunksManifest: manifest,
 *   baseDir: ".",
 *   sceneModel,
 *   dataModel
 * });
 * ```
 *
 * @module streaming
 */
export * from "./ModelChunksLoader";
