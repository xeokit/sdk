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
 *     class DataModelImporter {
 *       +format : "DataModelParams"
 *       +load(params, options?) Promise~void~
 *     }
 *     class DataModelExporter {
 *       +format : "DataModelParams"
 *       +write(params, options?) Promise~DataModelParams~
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
 *     ModelLoader <|-- DataModelImporter
 *     ModelExporter <|-- DataModelExporter
 *     DataModelImporter ..> DataModelParams : reads
 *     DataModelExporter ..> DataModelParams : writes
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
 * Use {@link DataModelExporter} to serialize a {@link model!data.DataModel | DataModel} into a
 * {@link model!data.DataModelParams | DataModelParams} object, which can then be stored or transmitted as JSON.
 *
 * `write` resolves with the `DataModelParams` object itself — stringify it yourself to persist it.
 *
 * ```ts
 * import { DataModelExporter } from "@xeokit/sdk/formats/datamodel";
 *
 * const exporter = new DataModelExporter();
 *
 * const dataModelParams = await exporter.write({
 *   dataModel
 * });
 *
 * const json = JSON.stringify(dataModelParams, null, 2);
 * // persist or transmit `json`
 * ```
 *
 * ### Importing a DataModel from JSON
 *
 * Use {@link DataModelImporter} to reconstruct a {@link model!data.DataModel | DataModel} from a previously
 * serialized {@link model!data.DataModelParams | DataModelParams} object. Create the target DataModel first,
 * then pass the params as `fileData` — `load` resolves with no value.
 *
 * ```ts
 * import { DataModelImporter } from "@xeokit/sdk/formats/datamodel";
 * import { Data } from "@xeokit/sdk/model/data";
 *
 * const data = new Data();
 * const dataModel = data.createModel({ id: "myModel" }).value;
 *
 * const loader = new DataModelImporter();
 *
 * await loader.load({
 *   fileData: dataModelParams,
 *   dataModel
 * });
 *
 * console.log("DataModel loaded:", dataModel.id);
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
 * @document ./README.md
 */
export * from "./DataModelImporter";
export * from "./DataModelExporter";
