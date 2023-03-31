/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%webifc.svg)](https://badge.fury.io/js/%40xeokit%webifc)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/webifc/badge)](https://www.jsdelivr.com/package/npm/@xeokit/webifc)
 *
 * <img style="width:150px; padding-top:20px; padding-bottom: 20px;" src="media://images/ifc_logo.png"/>
 *
 * # xeokit IFC Importer
 *
 * The xeokit SDK can import 3D building models from  Industry Foundation Classes ([IFC](/docs/pages/GLOSSARY.html#ifc)) files,
 * a standard file format used in the field of Building Information Modeling (BIM) to exchange information between
 * different software applications used in the construction and building industries.
 *
 * To import a medium-sized IFC model into xeokit, use the {@link loadWebIFC} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}. Internally, loadWebIFC
 * uses the [web-ifc](https://github.com/IFCjs/web-ifc) API to parse geometry and data from the IFC file.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUsFqwzAM_ZWg0zY62K6hFLaVQaFlpTns4otiK6uHYwfbYYTSf58dJ03bQVkuznt6lp5kHYAbQZADV-jcUuKXxZpppoW0xL00OlvvIu7jWcFJ0ybcUNmB6Sx8UqTTlN9B7xLgltDTR0_d3SeubKUSIxDkvDVdhMeYfcy_RI99-lvZG2sasr4r6Fa9xO1IYezC7WVzGdlOWf5lMRlcGxSfVK7e37YYJuXGMcznTcTkyS4WiUJrsXttq4psItxpeEOFsdkEf6iUFb-opk7VpjpVq_t3iWXOpEn2sl31yiF07ZbBE4PHxwWDZwbFmZ2bwuXk86_uYdKdLDA9GR-D1zdhBjXZGqUIy9c3x8DvqSYGefgVVGGrPIPQSZBi603RaQ65ty3NoG3C8GhYV8grVC6wJKQ3djMsdDyOv8sQ9og?type=png)](https://mermaid.live/edit#pako:eNqNUsFqwzAM_ZWg0zY62K6hFLaVQaFlpTns4otiK6uHYwfbYYTSf58dJ03bQVkuznt6lp5kHYAbQZADV-jcUuKXxZpppoW0xL00OlvvIu7jWcFJ0ybcUNmB6Sx8UqTTlN9B7xLgltDTR0_d3SeubKUSIxDkvDVdhMeYfcy_RI99-lvZG2sasr4r6Fa9xO1IYezC7WVzGdlOWf5lMRlcGxSfVK7e37YYJuXGMcznTcTkyS4WiUJrsXttq4psItxpeEOFsdkEf6iUFb-opk7VpjpVq_t3iWXOpEn2sl31yiF07ZbBE4PHxwWDZwbFmZ2bwuXk86_uYdKdLDA9GR-D1zdhBjXZGqUIy9c3x8DvqSYGefgVVGGrPIPQSZBi603RaQ65ty3NoG3C8GhYV8grVC6wJKQ3djMsdDyOv8sQ9og)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/webifc
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll import an IFC file into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and a {@link @xeokit/data!DataModel | DataModel}. The {@link @xeokit/core/components!SDKError} class
 * is used to handle errors that may occur during the process. Note how we initialize the
 * [WebIFC](https://github.com/IFCjs/web-ifc) API externally and pass it in as a parameter for {@link loadWebIFC}.
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Data} from "@xeokit/data";
 * import {loadWebIFC} from "@xeokit/webifc;
 * import * as WebIFC from "web-ifc/web-ifc-api-node";
 *
 * const scene = new Scene();
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * const data = new Data();
 *
 * const dataModel = data.createModel({
 *      id: "myModel"
 * });
 *
 * const ifcAPI = new WebIFC.IfcAPI();
 *
 * ifcAPI.SetWasmPath("path/to/wasm");
 *
 * ifcAPI.Init().then(() => {
 *
 *     fs.readFile("./tests/assets/IfcOpenHouse4.ifc", (err, fileData) => {
 *
 *          if (err) {
 *             console.error(err);
 *             return;
 *          }
 *
 *          loadWebIFC({
 *              data: toArrayBuffer(fileData),
 *              ifcAPI,
 *              sceneModel,
 *              dataModel
 *          }).then(() => {
 *
 *              sceneModel.build();
 *              dataModel.build();
 *
 *          }).catch((e) => {
 *              console.error(e);
 *          });
 *      });
 * });
 * ````
 *
 * @module @xeokit/webifc
 */
export * from "./loadWebIFC";