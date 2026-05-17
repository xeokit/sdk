/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit DataModelParams Importer and Exporter
 *
 * ---
 *
 * **Import and export semantic {@link model!data.DataModel | DataModels} using xeokit’s JSON-based
 * {@link model!data.DataModelParams | DataModelParams} interchange format.**
 *
 * ---
 *
 * This module provides utilities for serializing and deserializing {@link model!data.DataModel | DataModels}
 * to and from the SDK’s canonical JSON representation, {@link model!data.DataModelParams | DataModelParams}. The format captures
 * a DataModel’s complete semantic state, including objects, relationships, properties, and metadata.
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
 *     class DataModelParamsLoader {
 *       +format : "DataModelParams"
 *       +load(params, options?) Promise~void~
 *     }
 *     class DataModelParamsExporter {
 *       +format : "DataModelParams"
 *       +write(params, options?) Promise~string~
 *     }
 *     class DataModelParams {
 *       <<data>>
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- DataModelParamsLoader
 *     ModelExporter <|-- DataModelParamsExporter
 *     DataModelParamsLoader ..> DataModelParams : reads
 *     DataModelParamsExporter ..> DataModelParams : writes
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **xeokit-native JSON** — round-trips a
 *   {@link model!data.DataModel | DataModel} to and from
 *   {@link model!data.DataModelParams | DataModelParams} JSON.
 * - **Pairs with XGF** — geometry in `.xgf` + semantics in `.json`
 *   form the canonical xeokit streamed-model bundle.
 * - **Compact** — objects, relationships, and property sets only;
 *   no geometry payload.
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
 * ### Exporting a DataModel to JSON
 *
 * Use {@link DataModelParamsExporter} to serialize a {@link model!data.DataModel | DataModel} into a
 * {@link model!data.DataModelParams | DataModelParams} object, which can then be stored or transmitted as JSON.
 *
 * ```ts
 * import { DataModelParamsExporter } from "@xeokit/sdk/datamodel";
 *
 * const exporter = new DataModelParamsExporter();
 *
 * const paramsResult = exporter.write({
 *   dataModel
 * });
 *
 * if (!paramsResult.ok) {
 *   console.error(paramsResult.error);
 * } else {
 *   const dataModelParams = paramsResult.value;
 *   const json = JSON.stringify(dataModelParams, null, 2);
 *   // persist or transmit `json`
 * }
 * ```
 *
 * ### Importing a DataModel from JSON
 *
 * Use {@link DataModelParamsLoader} to reconstruct a {@link model!data.DataModel | DataModel} from a previously
 * serialized {@link model!data.DataModelParams | DataModelParams} object.
 *
 * ```ts
 * import { DataModelParamsLoader } from "@xeokit/sdk/datamodel";
 * import { Data } from "@xeokit/sdk/model/data";
 *
 * const data = new Data();
 *
 * const loader = new DataModelParamsLoader();
 *
 * const result = loader.load({
 *   dataModelParams,
 *   data
 * });
 *
 * if (!result.ok) {
 *   console.error(result.error);
 * } else {
 *   const dataModel = result.value;
 *   console.log("DataModel loaded:", dataModel.id);
 * }
 * ```
 *
 * ### Round-tripping DataModels
 *
 * Because {@link model!data.DataModelParams | DataModelParams} is a lossless representation of xeokit’s semantic graph,
 * a DataModel can be exported and re-imported without changing object IDs, relationships,
 * or properties—making it suitable for caching and synchronization workflows.
 *
 * ---
 *
 * @module datamodel
 */
export * from "./DataModelParamsLoader";
export * from "./DataModelParamsExporter";
