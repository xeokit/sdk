/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit SceneModelParams Importer and Exporter
 *
 * ---
 *
 * **Import and export renderable {@link model!scene.SceneModel | SceneModels} using xeokit’s JSON-based
 * {@link model!scene.SceneModelParams | SceneModelParams} interchange format.**
 *
 * ---
 *
 * This module provides utilities for serializing and deserializing {@link model!scene.SceneModel | SceneModels}
 * to and from the SDK’s canonical JSON representation, {@link model!scene.SceneModelParams | SceneModelParams}. The format captures
 * a SceneModel’s complete renderable state, including geometry, meshes, textures, materials,
 * transforms, and coordinate-system information.
 *
 * ---
 *
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class SceneModelImporter {
 *       +format : "SceneModelParams"
 *       +load(params, options?) Promise~void~
 *     }
 *     class SceneModelExporter {
 *       +format : "SceneModelParams"
 *       +write(params, options?) Promise~SceneModelParams~
 *     }
 *     class SceneModelParams {
 *       <<scene>>
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- SceneModelImporter
 *     ModelExporter <|-- SceneModelExporter
 *     SceneModelImporter ..> SceneModelParams : reads
 *     SceneModelExporter ..> SceneModelParams : writes
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **xeokit-native JSON** — round-trips a {@link model!scene.SceneModel | SceneModel}
 *   to and from
 *   {@link model!scene.SceneModelParams | SceneModelParams} JSON.
 * - **Lossless** — captures geometry buffers, textures, materials, transforms,
 *   and the model's origin / scale / basis triplet, so re-loading reproduces
 *   the original SceneModel without re-tessellating or re-quantizing.
 * - **Inspectable** — a single JSON document the host can diff, hand-edit,
 *   and version-control; useful as a debugging dump or fixture format in tests.
 *
 * ---
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ---
 *
 * ## Usage
 *
 * ### Exporting a SceneModel to JSON
 *
 * Use {@link SceneModelExporter} to serialize a {@link model!scene.SceneModel | SceneModel} into a
 * {@link model!scene.SceneModelParams | SceneModelParams} object, which can then be stored or transmitted as JSON.
 *
 * `write` resolves with the `SceneModelParams` object itself — stringify it yourself to persist it.
 *
 * ```ts
 * import { SceneModelExporter } from "@xeokit/sdk/scenemodel";
 *
 * const exporter = new SceneModelExporter();
 *
 * const sceneModelParams = await exporter.write({
 *   sceneModel
 * });
 *
 * const json = JSON.stringify(sceneModelParams, null, 2);
 * // persist or transmit `json`
 * ```
 *
 * ### Importing a SceneModel from JSON
 *
 * Use {@link SceneModelImporter} to reconstruct a {@link model!scene.SceneModel | SceneModel} from a previously
 * serialized {@link model!scene.SceneModelParams | SceneModelParams} object. Create the target SceneModel first,
 * pass the params as `fileData`, then `build` it once loaded — `load` resolves with no value.
 *
 * ```ts
 * import { SceneModelImporter } from "@xeokit/sdk/scenemodel";
 * import { Scene } from "@xeokit/sdk/model/scene";
 *
 * const scene = new Scene();
 * const sceneModel = scene.createModel({ id: "myModel" }).value;
 *
 * const loader = new SceneModelImporter();
 *
 * await loader.load({
 *   fileData: sceneModelParams,
 *   sceneModel
 * });
 *
 * console.log("SceneModel loaded:", sceneModel.id);
 * ```
 *
 * ### Round-tripping SceneModels
 *
 * {@link model!scene.SceneModelParams | SceneModelParams} is a lossless representation of a SceneModel’s internal state.
 * A SceneModel can be exported and re-imported without changing geometry IDs, object IDs,
 * transforms, or coordinate-system settings, making this format suitable for caching and
 * synchronization workflows.
 *
 * ---
 *
 * @module scenemodel
 * @document ./README.md
 */
export * from "./SceneModelImporter";
export * from "./SceneModelExporter";
