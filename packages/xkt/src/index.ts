/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fxkt.svg)](https://badge.fury.io/js/%40xeokit%2Fxkt)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/xkt/badge)](https://www.jsdelivr.com/package/npm/@xeokit/xkt)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) Importer and Exporter
 *
 * ---
 *
 * ### *Import models as xeokit's native binary [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) format*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D models from [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt), which is xeokit's
 * native runtime asset delivery format for model representations and semantics.
 *
 * The [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) format compresses large double-precision model geometry to
 * a compact payload that loads quickly over the Web into a xeokit viewer running in the browser.
 *
 * To import a [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) model into xeokit, use the {@link loadXKT} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * Use the {@link @xeokit/metamodel!loadMetamodel | loadMetamodel} function to load legacy JSON metadata into a {@link @xeokit/data!DataModel | DataModel}.
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
 * npm install @xeokit/xkt
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll use {@link loadXKT} to import an [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file into a
 * a {@link @xeokit/scene!SceneModel | SceneModel}. The {@link @xeokit/core!SDKError | SDKError} class
 * is used to handle errors that may occur during the process:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {loadXKT, saveXKT} from "@xeokit/xkt";
 *
 * const scene = new Scene();
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel
 * });
 *
 * if (sceneModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else {
 *      fetch("myModel.xkt").then(response => {
 *
 *         response.arrayBuffer().then(data => {
 *
 *              loadXKT({ data, dataModel, sceneModel });
 *
 *              sceneModel.build();
 *          });
 *      });
 * });
 * ````
 *
 * @module @xeokit/xkt
 */
export * from "./loadXKT";
export * from "./loadXKTManifest";
