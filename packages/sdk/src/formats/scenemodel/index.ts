/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit SceneModelParams Importer and Exporter
 *
 * ---
 *
 * **Import and export renderable {@link scene!SceneModel | SceneModels} using xeokit’s JSON-based
 * {@link scene!SceneModelParams} interchange format.**
 *
 * ---
 *
 * This module provides utilities for serializing and deserializing {@link scene!SceneModel | SceneModels}
 * to and from the SDK’s canonical JSON representation, {@link scene!SceneModelParams}. The format captures
 * a SceneModel’s complete renderable state, including geometry, meshes, textures, materials,
 * transforms, and coordinate-system information.
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
 * Use {@link SceneModelParamsExporter} to serialize a {@link scene!SceneModel | SceneModel} into a
 * {@link scene!SceneModelParams | SceneModelParams} object, which can then be stored or transmitted as JSON.
 *
 * ```ts
 * import { SceneModelParamsExporter } from "@xeokit/sdk/scenemodel";
 *
 * const exporter = new SceneModelParamsExporter();
 *
 * const paramsResult = exporter.write({
 *   sceneModel
 * });
 *
 * if (!paramsResult.ok) {
 *   console.error(paramsResult.error);
 * } else {
 *   const sceneModelParams = paramsResult.value;
 *   const json = JSON.stringify(sceneModelParams, null, 2);
 *   // persist or transmit `json`
 * }
 * ```
 *
 * ### Importing a SceneModel from JSON
 *
 * Use {@link SceneModelParamsLoader} to reconstruct a {@link scene!SceneModel | SceneModel} from a previously
 * serialized {@link scene!SceneModelParams|SceneModelParams} object.
 *
 * ```ts
 * import { SceneModelParamsLoader } from "@xeokit/sdk/scenemodel";
 * import { Scene } from "@xeokit/sdk/scene";
 *
 * const scene = new Scene();
 *
 * const loader = new SceneModelParamsLoader();
 *
 * const result = loader.load({
 *   sceneModelParams,
 *   scene
 * });
 *
 * if (!result.ok) {
 *   console.error(result.error);
 * } else {
 *   const sceneModel = result.value;
 *   console.log("SceneModel loaded:", sceneModel.id);
 * }
 * ```
 *
 * ### Round-tripping SceneModels
 *
 * {@link scene!SceneModelParams | SceneModelParams} is a lossless representation of a SceneModel’s internal state.
 * A SceneModel can be exported and re-imported without changing geometry IDs, object IDs,
 * transforms, or coordinate-system settings, making this format suitable for caching and
 * synchronization workflows.
 *
 * ---
 *
 * @module scenemodel
 */
export * from "./SceneModelParamsLoader";
export * from "./SceneModelParamsExporter";
