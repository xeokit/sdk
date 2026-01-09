/**
 * <img style="padding: 30px 0 10px 0; height: 130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Multi-Format Model Converter
 *
 * ---
 *
 * **An extensible tool for converting 3D models between various formats.**
 *
 * ---
 *
 * This module provides the {@link ModelConverter | ModelConverter} class for converting 3D model data between multiple file formats.
 *
 * <br>
 *
 * # Installation
 *
 * Install the xeokit SDK:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * <br>
 *
 * # Usage
 *
 * ## Using the ModelConverter Class
 *
 * The {@link ModelConverter | ModelConverter} manages file format conversions via a set of predefined:
 *
 * - **{@link io!ModelLoader | ModelLoaders}**: loaders for input formats
 * - **{@link io!ModelExporter | ModelExporters}**: generators for output formats
 * - **Pipelines**: structured workflows describing how inputs are transformed into outputs
 *
 * <br>
 *
 * ## Converting a DotBIM file to XGF and DataModelParams JSON formats
 *
 * ### 1. Import dependencies
 *
 * ````ts
 * import { readFile, writeFile } from 'fs/promises';
 * import path from 'path';
 *
 * import { ModelConverter } from "@xeokit/sdk/modelconverter";
 * import { DotBIMLoader } from "@xeokit/sdk/dotbim";
 * import { XGFExporter } from "@xeokit/sdk/xgf";
 * import { DataModelParamsExporter } from "@xeokit/sdk/data";
 * ````
 *
 * ### 2. Set up the converter
 *
 * Create a {@link ModelConverter | ModelConverter} instance, configured with loaders,
 * exporters, and a single "dotbim2xgf" pipeline definition that connects those together to perform our conversion.
 *
 * The loaders and exporters we'll use are:
 *
 * - {@link dotbim!DotBIMLoader | DotBIMLoader} to load `.bim` files
 * - {@link xgf!XGFExporter | XGFExporter} to export geometry to `.xgf`
 * - {@link data!DataModelParamsExporter | DataModelParamsExporter} for exporting semantic metadata
 *
 * ````ts
 * const modelConverter = new ModelConverter({
 *     loaders: {
 *         dotbim: new DotBIMLoader()
 *     },
 *     exporters: {
 *         xgf: new XGFExporter(),
 *         datamodel: new DataModelParamsExporter()
 *     },
 *     pipelines: {
 *         dotbim2xgf: {
 *             inputs: {
 *                 dotbim: {
 *                     loader: "dotbim",
 *                     options: {}
 *                 }
 *             },
 *             outputs: {
 *                 xgf: {
 *                     exporter: "xgf",
 *                     version: "1.0",
 *                     options: {}
 *                 },
 *                 datamodel: {
 *                     exporter: "datamodel",
 *                     version: "1.0",
 *                     options: {}
 *                 }
 *             }
 *         }
 *     }
 * });
 * ````
 *
 * ### 3. Perform the conversion
 *
 * ````ts
 * const dotBIMFileData = JSON.parse(await readFile("model.bim", "utf-8"));
 *
 * modelConverter.convert({
 *      pipeline: "dotbim2xgf",
 *      inputs: {
 *         dotbim: {
 *           fileData: dotBIMFileData
 *         }
 *      }
 * }).then(async result => {
 *
 *      const xgfOutput = result.outputs.xgf;
 *
 *      const xgfFileData = xgfOutput.fileData;
 *      const xgfFileDataType = xgfOutput.fileDataType; // "arraybuffer"
 *      const xgfVersion = xgfOutput.version; // "1.0.0"
 *      const xgfSceneModel = xgfOutput.sceneModel;
 *      const xgfDataModel = xgfOutput.dataModel;
 *
 *      const datamodelOutput = result.outputs.datamodel;
 *
 *      const datamodelFileData = datamodelOutput.fileData;
 *      const datamodelFileDataType = datamodelOutput.fileDataType; // "json"
 *      const datamodelVersion = datamodelOutput.version; // "1.1.0"
 *      const datamodelSceneModel = datamodelOutput.sceneModel;
 *      const datamodelDataModel = datamodelOutput.dataModel;
 *
 *     await writeFile("model.xgf", xgfFileData);
 *     await writeFile("model.json", JSON.stringify(datamodelFileData, null, 2), "utf-8");
 * });
 * ````
 *
 * <br>
 *
 * ## Converting XGF and DataModelParams JSON back to DotBIM
 *
 * ### 1. Import dependencies
 *
 * ````ts
 * import { readFile, writeFile } from 'fs/promises';
 * import path from 'path';
 *
 * import { ModelConverter } from "@xeokit/sdk/modelconverter";
 * import { DotBIMLoader } from "@xeokit/sdk/dotbim";
 * import { XGFExporter } from "@xeokit/sdk/xgf";
 * import { DataModelParamsExporter } from "@xeokit/sdk/data";
 * ````
 *
 * ### 2. Set up the converter
 *
 * Create a {@link ModelConverter | ModelConverter} instance, configured with loaders,
 * exporters, and a single "dotbim2xgf" pipeline definition that connects those together to perform our conversion.
 *
 * The loaders and exporters we'll use are:
 *
 * - {@link dotbim!DotBIMLoader | DotBIMLoader} to load `.bim` files
 * - {@link xgf!XGFExporter | XGFExporter} to export geometry to `.xgf`
 * - {@link data!DataModelParamsExporter | DataModelParamsExporter} for exporting semantic metadata
 *
 * ````ts
 * const modelConverter = new ModelConverter({
 *     loaders: {
 *         xgf: new XGFLoader(),
 *         datamodel: new DataModelParamsLoader()
 *     },
 *     exporters: {
 *         dotbim: new DotBIMExporter()
 *     },
 *     pipelines: {
 *         xgf2dotbim: {
 *             inputs: {
 *                 xgf: {
 *                     loader: "xgf",
 *                     sceneModel: "mySceneModel",
 *                     options: {}
 *                 },
 *                 datamodel: {
 *                     loader: "datamodel",
 *                     dataModel: "myDataModel",
 *                     options: {}
 *                 }
 *             },
 *             outputs: {
 *                 dotbim: {
 *                     exporter: "dotbim",
 *                     sceneModel: "mySceneModel",
 *                     dataModel: "myDataModel",
 *                     version: "1.1",
 *                     options: {}
 *                 }
 *             }
 *         }
 *     }
 * });
 * ````
 *
 * ### 3. Perform the conversion
 *
 * ````ts
 * const xgfFileData = await readFile("model.xgf");
 * const datamodelFileData = JSON.parse(await readFile("model.json", "utf-8"));
 *
 * modelConverter.convert({
 *     pipeline: "xgf2dotbim",
 *     inputs: {
 *         xgf: {
 *            fileData: xgfFileData
 *         },
 *         datamodel: {
 *            fileData: datamodelFileData
 *         }
 *     }
 * }).then(async result => {
 *     const dotbimFileData = result.outputs.dotbim.fileData;
 *     await writeFile("model.bim", dotbimFileData, "utf-8");
 * });
 * ````
 *
 * @module modelconverter
 */
export * from "./ModelConverter";
export * from "./ModelConverterParams";
export * from "./ModelConverterPipelineConfig";
export * from "./ModelConverterInputConfig";
export * from "./ModelConverterOutputConfig";

export * from "./ModelConverterConfig";

export * from "./ModelConverterRequest";
export * from "./ModelConverterResult";
export * from "./ModelConverterResultInput";
export * from "./ModelConverterResultOutput";

export * as reporters from "./reporters"
// export * as exporters from "./exporters";

