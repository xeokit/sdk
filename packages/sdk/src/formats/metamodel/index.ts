/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;"
 *      src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Legacy MetaModel Utilities
 *
 * ---
 *
 * **Utilities for importing and migrating semantic data from xeokit's legacy MetaModel format.**
 *
 * ---
 *
 * This module helps you move from xeokit's older `MetaModel` format to the newer
 * `DataModel`, which represents semantic information as an entity–relationship
 * graph with property sets.
 *
 * You can either:
 * - Load legacy MetaModel data directly into a `DataModel`, or
 * - Convert MetaModel data into `DataModelParams` first, then load it explicitly
 *
 * ---
 *
 * <br>
 *
 * ## Overview
 *
 * xeokit's legacy `MetaModel` format represents a simple hierarchy of entities
 * with attached property sets. While still supported for compatibility, it has
 * been superseded by the `DataModel`, which offers a richer and more flexible
 * semantic representation.
 *
 * This module provides utilities to bridge the two formats.
 *
 * ### Key components
 *
 * - {@link convertMetaModel | convertMetaModel}
 *   Converts a `MetaModelParams` object into a `DataModelParams` object.
 * - {@link MetaModelLoader | MetaModelLoader}
 *   Loads a `MetaModelParams` object directly into an existing `DataModel`.
 * - {@link model!data.DataModel | DataModel}
 *   The modern semantic data model used by xeokit, based on entity–relationship graphs.
 * - {@link model!data.DataModelParams | DataModelParams}
 *   The JSON format used to populate a `DataModel`.
 * - {@link MetaModelParams | MetaModelParams}
 *   The legacy JSON format describing a hierarchy of entities with property sets.
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
 *     class MetaModelLoader {
 *       +format : "MetaModel"
 *       +load(params, options?) Promise~void~
 *     }
 *     class convertMetaModel {
 *       <<function>>
 *       +(metaModelParams) DataModelParams
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- MetaModelLoader
 *     convertMetaModel ..> MetaModelLoader : upgrades to v3
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Legacy V2 MetaModel** — preserves the older xeokit-sdk V2
 *   metadata format for backward compatibility with existing
 *   `xeokit-convert` outputs.
 * - **Convert-then-load** — {@link convertMetaModel} adapts the
 *   V2 shape to V3 {@link model!data.DataModelParams | DataModelParams};
 *   feed the result to {@link formats!datamodel.DataModelImporter | DataModelImporter}
 *   for a single-format pipeline.
 *
 * ---
 *
 * ## Installation
 *
 * Install the xeokit SDK using npm:
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ---
 *
 * ## Usage
 *
 * The following examples show two common migration workflows.
 *
 * ---
 *
 * ### Option 1: Load MetaModel data directly into a DataModel
 *
 * Use {@link MetaModelLoader} when you want to load legacy MetaModel data
 * straight into a `DataModel` without creating intermediate parameters.
 *
 * #### Step 1: Create a DataModel
 *
 * ```js
 * import { Data } from "@xeokit/sdk/model/data";
 * import { MetaModelLoader } from "@xeokit/sdk/formats/metamodel";
 *
 * const data = new Data();
 *
 * const dataModelResult = data.createModel({
 *     id: "myModel"
 * });
 *
 * const dataModel = dataModelResult.value;
 * ```
 *
 * #### Step 2: Load the MetaModelParams
 *
 * ```js
 * const metaModelLoader = new MetaModelLoader();
 *
 * fetch("myMetaModel.json").then(response => {
 *     response.json().then(metaModelParams => {
 *         // Load MetaModelParams directly into the DataModel
 *         metaModelLoader.load({
 *             fileData: metaModelParams,
 *             dataModel
 *         });
 *     });
 * });
 * ```
 *
 * ---
 *
 * ### Option 2: Convert MetaModel data before loading
 *
 * Use {@link convertMetaModel | convertMetaModel} when you want access to
 * `DataModelParams`—for example, to inspect, modify, or store the converted
 * data before loading it.
 *
 * #### Step 1: Create a DataModel
 *
 * ```js
 * import { Data } from "@xeokit/sdk/model/data";
 * import { convertMetaModel } from "@xeokit/sdk/metamodel";
 *
 * const data = new Data();
 *
 * const dataModelResult = data.createModel({
 *     id: "myModel"
 * });
 *
 * const dataModel = dataModelResult.value;
 * ```
 *
 * #### Step 2: Convert MetaModelParams to DataModelParams
 *
 * ```js
 * fetch("myMetaModel.json").then(response => {
 *     response.json().then(metaModelParams => {
 *         // Convert MetaModelParams -> DataModelParams
 *         const dataModelParams = convertMetaModel(metaModelParams);
 *
 *         // Load DataModelParams into the DataModel
 *         dataModel.fromParams(dataModelParams);
 *     });
 * });
 * ```
 *
 * ---
 *
 * @module metamodel
 */
export * from "./MetaModelLoader";
export * from "./convertMetaModel";
export * from "./MetaModelParams";
export * from "./MetaObjectParams";
export * from "./MetaPropertySetParams";
export * from "./MetaPropertyParams";


