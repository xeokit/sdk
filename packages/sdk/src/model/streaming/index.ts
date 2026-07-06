/**
 * <img style="padding:50px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_datamodel_icon.png"/>
 *
 * # xeokit Streaming Loader
 *
 * ---
 *
 * **Loads chunked models from a manifest into a
 * {@link model!scene.SceneModel | SceneModel} and optional
 * {@link model!data.DataModel | DataModel}.**
 *
 * ---
 *
 * Large BIM and CAD models are often delivered as chunked geometry
 * plus matching semantic data. `ModelChunksLoader` reads a manifest
 * for those chunks and loads each one with the configured per-chunk
 * loader.
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
 * - **One call loads the whole model** — pass the manifest, `baseDir`, and the target SceneModel + DataModel.
 * - **Pluggable per-chunk loaders**; pass an
 *   {@link formats!XGFLoader | XGFLoader} for geometry,
 *   {@link formats!datamodel.DataModelImporter | DataModelImporter}
 *   for semantics, or any other loader that implements
 *   {@link formats!ModelLoader | ModelLoader}.
 * - **Geometry and semantics stay aligned** — chunks share an
 *   ordering so the loader emits {@link model!scene.SceneObject | SceneObjects}
 *   and {@link model!data.DataObject | DataObjects} with matching ids.
 * - **Resolves when loading finishes** — the returned Promise settles once every chunk reaches its target model.
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
