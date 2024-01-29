/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdtx.svg)](https://badge.fury.io/js/%40xeokit%2Fdtx)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/dtx/badge)](https://www.jsdelivr.com/package/npm/@xeokit/dtx)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) Importer and Exporter
 *
 * ---
 *
 * ### *Import and export models as xeokit's native binary [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) format*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D models from [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx), which is xeokit's
 * native runtime asset delivery format for model representations and semantics.
 *
 * The [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) format compresses large double-precision model representations and semantic data to a compact payload that
 * loads quickly over the Web into a xeokit viewer running in the browser.
 *
 * To import a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) model into xeokit, use the {@link loadDTX} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}.
 *
 * To export a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) model from xeokit, use the {@link saveDTX} function, which will save a
 * {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel} to [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data.
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
 * npm install @xeokit/dtx
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll use {@link loadDTX} to import a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file into a {@link @xeokit/data!DataModel | DataModel} and
 * a {@link @xeokit/scene!SceneModel | SceneModel}. The {@link @xeokit/core!SDKError} class
 * is used to handle errors that may occur during the process:
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import {Scene} from "@xeokit/scene";
 * import {loadDTX, saveDTX} from "@xeokit/dtx";
 *
 * const data = new Data();
 * const scene = new Scene();
 *
 * const dataModel = data.createModel({
 *     id: "myModel
 * });
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel
 * });
 *
 * if (dataModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else if (sceneModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else {
 *      fetch("myModel.dtx").then(response => {
 *
 *         response.arrayBuffer().then(data => {
 *
 *              loadDTX({ data, dataModel, sceneModel });
 *
 *              dataModel.build();
 *              sceneModel.build();
 *          });
 *      });
 * });
 * ````
 *
 * Using {@link @xeokit/dtx!saveDTX} to export the {@link @xeokit/data!DataModel | DataModel} and {@link @xeokit/scene!SceneModel | SceneModel} to
 * [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data in an ArrayBuffer:
 *
 * ````javascript
 * const arrayBuffer = saveDTX({
 *     dataModel,
 *     sceneModel
 * });
 * ````
 *
 * @module @xeokit/dtx
 */
export * from "./loadDTX";
export * from "./saveDTX";
export * from "./DTXData";