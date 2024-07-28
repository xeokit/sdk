/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fmetamodel.svg)](https://badge.fury.io/js/%40xeokit%2Fmetamodel)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/metamodel/badge)](https://www.jsdelivr.com/package/npm/@xeokit/metamodel)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit [Legacy Metamodel](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#metamodel) Importer and Exporter
 *
 * ---
 *
 * ### *Import data models from xeokit's [legacy metamodel](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#metamodel) format*
 *
 * ---
 *
 * To import a [legacy metamodel](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#metamodel) model into xeokit, use the {@link loadMetamodel} function, which will load the file into
 * a {@link @xeokit/data!DataModel | DataModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNU01rwzAM_StBpw1a2K6h9DB6W8tKs8EOvqixsro4dvDHIJT-99lx0iaMlubi6El6T0_GJyg1J8ihlGjtSuCPwZopprgwVDqhVbbexbjLZ0VJijahQ2YnprLwCZ5OvT-GepuC0hA6-uigp-eE7b2QfAg4WWd0G8NzZB_4V-iwo7_H3hjdkHFtQff0ErYjidGFPYhmmtleWR4aMQ241si_3z-3GNZkhx0sFk2MyZFZLhOExmD75quKTALsZXM9_eB0Qi8T_ZW48qq7hcg7qivwlx4Z4zFVm9juqE5sM3hhMJ8vGbwyKEYKt6tWV93e4pCZ9OTZlyWbXWzYqD3xelP7dtVIuzd66R_3_NOGGdRkahQ8PI9uNQzcgWpikIdfThV66RiEFYVS9E4XrSohd8bTDHwTdk39g4K8QmkDSlw4bTb9k4vH-Q8aQzAW?type=png)](https://mermaid.live/edit#pako:eNqNU01rwzAM_StBpw1a2K6h9DB6W8tKs8EOvqixsro4dvDHIJT-99lx0iaMlubi6El6T0_GJyg1J8ihlGjtSuCPwZopprgwVDqhVbbexbjLZ0VJijahQ2YnprLwCZ5OvT-GepuC0hA6-uigp-eE7b2QfAg4WWd0G8NzZB_4V-iwo7_H3hjdkHFtQff0ErYjidGFPYhmmtleWR4aMQ241si_3z-3GNZkhx0sFk2MyZFZLhOExmD75quKTALsZXM9_eB0Qi8T_ZW48qq7hcg7qivwlx4Z4zFVm9juqE5sM3hhMJ8vGbwyKEYKt6tWV93e4pCZ9OTZlyWbXWzYqD3xelP7dtVIuzd66R_3_NOGGdRkahQ8PI9uNQzcgWpikIdfThV66RiEFYVS9E4XrSohd8bTDHwTdk39g4K8QmkDSlw4bTb9k4vH-Q8aQzAW)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/metamodel
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll use {@link loadMetamodel} to import an [METAMODEL](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#metamodel) file into a
 * a {@link @xeokit/data!DataModel | DataModel}. The {@link @xeokit/core!SDKError} class
 * is used to handle errors that may occur during the process:
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import {loadMetamodel} from "@xeokit/metamodel";
 *
 * const data = new Data();
 *
 * const dataModel = data.createModel({
 *     id: "myModel
 * });
 *
 * if (dataModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else {
 *      fetch("myModel.metamodel").then(response => {
 *
 *         response.json().then(data => {
 *
 *              loadMetamodel({ data, dataModel });
 *
 *              dataModel.build();
 *          });
 *      });
 * });
 * ````
 *
 * @module @xeokit/metamodel
 */
export * from "./loadMetamodel";
