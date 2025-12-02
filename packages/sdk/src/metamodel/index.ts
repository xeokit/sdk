/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Legacy MetaModel Utilities
 *
 * ---
 *
 * ***Utilities for importing and migrating data models from xeokit's legacy MetaModel format***
 *
 * This module provides functions for converting and loading legacy MetaModel data into xeokit's newer semantic data model,
 * the `DataModel`, which is based on an entity-relationship graph with property sets.
 *
 * ---
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNU01rwzAM_StBpw1a2K6h9DB6W8tKs8EOvqixsro4dvDHIJT-99lx0iaMlubi6El6T0_GJyg1J8ihlGjtSuCPwZopprgwVDqhVbbexbjLZ0VJijahQ2YnprLwCZ5OvT-GepuC0hA6-uigp-eE7b2QfAg4WWd0G8NzZB_4V-iwo7_H3hjdkHFtQff0ErYjidGFPYhmmtleWR4aMQ241si_3z-3GNZkhx0sFk2MyZFZLhOExmD75quKTALsZXM9_eB0Qi8T_ZW48qq7hcg7qivwlx4Z4zFVm9juqE5sM3hhMJ8vGbwyKEYKt6tWV93e4pCZ9OTZlyWbXWzYqD3xelP7dtVIuzd66R_3_NOGGdRkahQ8PI9uNQzcgWpikIdfThV66RiEFYVS9E4XrSohd8bTDHwTdk39g4K8QmkDSlw4bTb9k4vH-Q8aQzAW?type=png)](https://mermaid.live/edit#pako:eNqNU01rwzAM_StBpw1a2K6h9DB6W8tKs8EOvqixsro4dvDHIJT-99lx0iaMlubi6El6T0_GJyg1J8ihlGjtSuCPwZopprgwVDqhVbbexbjLZ0VJijahQ2YnprLwCZ5OvT-GepuC0hA6-uigp-eE7b2QfAg4WWd0G8NzZB_4V-iwo7_H3hjdkHFtQff0ErYjidGFPYhmmtleWR4aMQ241si_3z-3GNZkhx0sFk2MyZFZLhOExmD75quKTALsZXM9_eB0Qi8T_ZW48qq7hcg7qivwlx4Z4zFVm9juqE5sM3hhMJ8vGbwyKEYKt6tWV93e4pCZ9OTZlyWbXWzYqD3xelP7dtVIuzd66R_3_NOGGdRkahQ8PI9uNQzcgWpikIdfThV66RiEFYVS9E4XrSohd8bTDHwTdk39g4K8QmkDSlw4bTb9k4vH-Q8aQzAW)
 *
 * <br>
 *
 * # Overview
 *
 * This module includes functions that help you migrate from xeokit's legacy `MetaModel` format to the newer `DataModel` format.
 *
 * Key functions:
 *
 * * {@link metamodel!convertMetaModel | convertMetaModel}: Converts a `MetaModelParams` object into a `DataModelParams` object.
 * * {@link metamodel!MetaModelLoader | MetaModelLoader}: Loads a `MetaModelParams` object directly into a `DataModel` instance.
 * * {@link data!DataModel | DataModel}: The newer, semantic data model in xeokit based on entity-relationship graphs and property sets.
 * * {@link data!DataModelParams | DataModelParams}: The JSON data format that can be loaded into a `DataModel`.
 * * {@link metamodel!MetaModelParams | MetaModelParams}: The older JSON data format representing a simple entity hierarchy with property sets.
 *
 * ---
 *
 * # Installation
 *
 * To install the xeokit SDK, run the following npm command:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ---
 *
 * # Usage
 *
 * ## Loading MetaModel data into a DataModel
 *
 * The following example shows how to use {@link MetaModelLoader} to load a `MetaModelParams` file directly into a `DataModel` instance:
 *
 * ````javascript
 * import {Data} from "@xeokit/sdk/data";
 * import {MetaModelLoader} from "@xeokit/sdk/metamodel";
 *
 * const data = new Data();
 * const dataModelResult = data.createModel({
 *     id: "myModel"
 * });
 * const dataModel = dataModelResult.value;
 *
 * const metaModelLoader = new MetaModelLoader();
 *
 * fetch("myMetaModel.json").then(response => {
 *     response.json().then(metaModelParams => {
 *         // Load MetaModelParams directly into DataModel
 *         metaModelLoader.load({
 *             fileData: metaModelParams,
 *             dataModel
 *         });
 *     });
 * });
 * ````
 *
 * ## Converting MetaModel data into DataModel data
 *
 * This example demonstrates how to use {@link metamodel!convertMetaModel | convertMetaModel} to convert a `MetaModelParams` file
 * into a `DataModelParams` object, and then load that into a `DataModel`.
 *
 * ````javascript
 * import {Data} from "@xeokit/sdk/data";
 * import {convertMetaModel} from "@xeokit/sdk/metamodel";
 *
 * const data = new Data();
 * const dataModelResult = data.createModel({
 *     id: "myModel"
 * });
 * const dataModel = dataModelResult.value;
 *
 * fetch("myMetaModel.json").then(response => {
 *     response.json().then(metaModelParams => {
 *         // Convert MetaModelParams -> DataModelParams
 *         const dataModelParams = convertMetaModel(metaModelParams);
 *
 *         // Load DataModelParams into DataModel
 *         dataModel.fromParams(dataModelParams);
 *     });
 * });
 * ````
 *
 * @module metamodel
 */
export * from "./MetaModelLoader";
export * from "./convertMetaModel";
export * from "./MetaModelParams";
export * from "./MetaObjectParams";
export * from "./MetaPropertySetParams";
export * from "./MetaPropertyParams";


