/**
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit [Legacy MetaModel](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#metamodel) Utilities
 *
 * ---
 *
 * ### *Import data models from xeokit's [legacy metamodel](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#metamodel) format*
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
 * * {@link metamodel!convertMetaModel | convertMetaModel} migrates a {@link metamodel!MetaModelParams | MetaModelParams} into a {@link data!DataModelParams | DataModelParams}.
 * * {@link metamodel!loadMetaModel | loadMetaModel} loads a {@link metamodel!MetaModelParams | MetaModelParams} directly into a {@link data!DataModel | DataModel}.
 * * {@link data!DataModel | DataModel} is xeokit's newer semantic data model, an entity-relationship graph with property sets.
 * * {@link data!DataModelParams | DataModelParams} is a JSON data format that can be loaded into a DataModel.
 * * {@link metamodel!MetaModelParams | MetaModelParams} is xeokit's older JSON data model format, a simple entity hierarchy with property sets.
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/metamodel
 * ````
 *
 * # Usage
 *
 * ## Loading MetaModel data into a DataModel
 *
 * In the example below, we'll use {@link loadMetaModel} to load a {@link metamodel!MetaModelParams | MetaModelParams} file directly into a
 * a {@link data!DataModel | DataModel}.
 *
 * ````javascript
 * import {Data} from "@xeokit/sdk/data";
 * import {loadMetaModel} from "@xeokit/sdk/metamodel";
 *
 * const data = new Data();
 *
 * const dataModel = data.createModel({
 *     id: "myModel
 * });
 *
 * fetch("myMetaModel.json").then(response => {
 *
 *     response.json().then(metaModelParams => {
 *
 *         // Load MetaModelParams Directly into our DataModel
 *
 *        loadMetaModel({
 *            fileData: metaModelParams,
 *            dataModel
 *        });
 *
 *        dataModel.build();
 *     });
 * });
 * ````
 *
 * ## Converting MetaModel data into DataModel data
 *
 * In the next example, we'll use {@link metamodel!convertMetaModel | convertMetaModel} to convert a
 * {@link metamodel!MetaModelParams | MetaModelParams} file into a {@link data!DataModelParams | DataModelParams},
 * and then load that into a {@link data!DataModel | DataModel}.
 *
 * ````javascript
 * import {Data} from "@xeokit/sdk/data";
 * import {loadMetaModel} from "@xeokit/sdk/metamodel";
 *
 * const data = new Data();
 *
 * const dataModel = data.createModel({
 *     id: "myModel
 * });
 *
 * fetch("myMetaModel.json").then(response => {
 *
 *     response.json().then(metaModelParams => {
 *
 *          // Convert MetaModelParams -> DataModelParams
 *
 *         const dataModelParams = convertMetaModel(metaModelParams)
 *
 *          // Then we could load the DataModelParams into our DataModel
 *
 *         dataModel.fromJSON(dataModelParams);
 *
 *         dataModel.build();
 *     });
 * });
 * ````
 *
 * @module metamodel
 */
export * from "./loadMetaModel";
export * from "./convertMetaModel";
export * from "./MetaModelParams";
export * from "./MetaObjectParams";
export * from "./MetaPropertySetParams";
export * from "./MetaPropertyParams";
//# sourceMappingURL=index.js.map