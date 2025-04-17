/**
 * <img style="padding:10px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # xeokit SDK File I/O Components
 *
 * # Installation
 *
 * ```bash
 * npm install @xeokit/io
 * ```
 *
 * # Usage
 *
 * ```javascript
 * import { Loader, Exporter, Converter } from "@xeokit/sdk/io";
 * import { DotBIMLoader, DotBIMExporter } from "@xeokit/sdk/dotbim";
 * import { GLTFLoader } from "@xeokit/sdk/gltf";
 *
 * const converter = new Converter({
 *     readers: {
 *         ifc: new WebIFCReader({ ... }),
 *         dotbim: new DotBIMLoader(),
 *         glb: new GLTFLoader(),
 *     },
 *     writers: {
 *         dotbim: new DotBIMExporter(),
 *         xgf: new xgfExporter(),
 *         datamodel: new DataModeParamsExporter(),
 *     },
 *     pipelines: {
 *         ifc2xgf: {
 *             inputs: {
 *                 ifc: {
 *                     reader: "ifc",
 *                     options: {},
 *                 },
 *             },
 *             outputs: {
 *                 xgf: {
 *                     writer: "xgf",
 *                     version: "1.0",
 *                     options: {},
 *                 },
 *                 datamodel: {
 *                     writer: "datamodel",
 *                     version: "1.0",
 *                     options: {},
 *                 },
 *             },
 *         },
 *         xgf2dotbim: {
 *             inputs: {
 *                 xgf: {
 *                     reader: "xgf",
 *                     sceneModel: "mySceneModel",
 *                     options: {},
 *                 },
 *                 datamodel: {
 *                     reader: "datamodel",
 *                     dataModel: "myDataModel",
 *                     options: {},
 *                 },
 *             },
 *             outputs: {
 *                 dotbim: {
 *                     writer: "dotbim",
 *                     version: "1.0",
 *                     sceneModel: "mySceneModel",
 *                     dataModel: "myDataModel",
 *                     options: {},
 *                 },
 *             },
 *         },
 *     },
 * });
 * ```
 *
 *
 * ````javascript
 *   fetch("model.ifc").then(response => {
 *         response.arrayBuffer().then(fileData => {
 *
 *          converter.convert({
 *                  pipeline: "ifc2xgf",
 *                  inputs: {
 *                      ifc: fileData
 *                  }
 *              }).then(conversionResults => {
 *
 *                  const xgf = conversionResults.xgf;
 *                  const datamodel = conversionResults.datamodel;
 *
 *                  //...
 *
 *              }).catch(reason => {
 *                  console.log(`Error during conversion: ${reason}`);
 *              });
 *
 *
 *          converter.convert({
 *              pipeline: "gltf2xgf",
 *              inputs: {
 *                  inputFileData: null
 *              }
 *          }).then(conversionResults => {
 *              const pipeline = result.pipeline;
 *              const outputs = result.outputs;
 *              const outputFileData = outputs.outputFileData;
 *              const outputDataModel = outputFileData.dataModel;
 *              //...
 *          }).catch(reason => {
 *     });
 * ````
 * @module io
 */
export {Loader} from "./Loader";
export {Exporter} from "./Exporter";
export {LoaderParams} from "./LoaderParams";
export {LoadParams} from "./LoadParams";
export {ExportParams} from "./ExportParams";
export {EncodeParams} from "./EncodeParams";
export {ExporterParams} from "./ExporterParams";
export {ParseParams} from "./ParseParams";
//export {FileLoader} from "./FileLoader";
