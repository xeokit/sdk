/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fxkt.svg)](https://badge.fury.io/js/%40xeokit%2Fxkt)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/xkt/badge)](https://www.jsdelivr.com/package/npm/@xeokit/xkt)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit XKT Importer and Exporter
 *
 * * [XKT](/docs/pages/GLOSSARY.html#xkt) is xeokit's native compressed model format, which contains geometry, materials, objects and semantic data in a
 * compact, Web-friendly payload.
 * * Use {@link loadXKT} to import XKT files into {@link @xeokit/scene!SceneModel | SceneModels} and {@link @xeokit/data!DataModel | DataModels}.
 * * Use {@link saveXKT} to export {@link @xeokit/scene!SceneModel | SceneModels} and {@link @xeokit/data!DataModel | DataModels} to XKT files.
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
 * Using {@link loadXKT} to import an XKT file into a {@link @xeokit/data!DataModel | DataModel} and a {@link @xeokit/scene!SceneModel | SceneModel}:
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import {Scene} from "@xeokit/scene";
 * import {loadXKT, saveXKT} from "@xeokit/xkt";
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
 * fetch("myModel.xkt").then(response => {
 *
 *     response.arrayBuffer().then(data => {
 *
 *          loadXKT({ data, dataModel, sceneModel });
 *
 *          dataModel.build();
 *          sceneModel.build();
 *     })
 * });
 * ````
 *
 * Using {@link saveXKT} to export the {@link @xeokit/data!DataModel | DataModel} and {@link @xeokit/scene!SceneModel | SceneModel} to
 * XKT file data in an ArrayBuffer:
 *
 * ````javascript
 * const arrayBuffer = saveXKT({
 *     dataModel,
 *     sceneModel
 * });
 * ````
 *
 * @module @xeokit/xkt
 */
export * from "./loadXKT";
export * from "./saveXKT";