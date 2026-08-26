/**
 * <img style="padding: 30px 0 10px 0; height: 130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # Conversion Pipeline
 *
 * Converts model data using registered loaders, exporters, and named
 * pipelines.
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class ModelConverter {
 *       +loaders   : Map~id, ModelLoader~
 *       +exporters : Map~id, ModelExporter~
 *       +pipelines : Map~id, Pipeline~
 *       +convert(request) Promise~ModelConverterResult~
 *     }
 *     class ModelConverterParams {
 *       +loaders
 *       +exporters
 *       +pipelines
 *     }
 *     class ModelConverterRequest {
 *       +pipeline   : string
 *       +inputs     : Map
 *       +outputs    : Map
 *       +reports?   : Map
 *     }
 *     class ModelConverterResult {
 *       +outputs    : Map
 *       +inspection? : ModelConverterInspectionReport
 *       +manifest?   : ModelConverterManifestReport
 *       +stats?      : ModelConverterStatsReport
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelConverter ..> ModelConverterParams : constructor
 *     ModelConverter ..> ModelConverterRequest : convert
 *     ModelConverter ..> ModelConverterResult : returns
 *     ModelConverter "1" *-- "*" ModelLoader
 *     ModelConverter "1" *-- "*" ModelExporter
 * ```
 *
 * ## Components
 *
 * - {@link formats!ModelLoader | ModelLoaders} parse input formats
 *   into scene and data models.
 * - {@link formats!ModelExporter | ModelExporters} write output
 *   formats from those models.
 * - Pipelines map input ids to loader ids and output ids to exporter
 *   ids.
 * - Optional reports include inspection, manifest, stats,
 *   optimization, and conversion details.
 * - The {@link conversion!xeoconvert | xeoconvert} CLI uses the same
 *   converter.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * Configure {@link ModelConverter | ModelConverter} with
 * {@link ModelConverterParams | ModelConverterParams}:
 *
 * - `loaders`: a map of loader instances (keyed by id)
 * - `exporters`: a map of exporter instances (keyed by id)
 * - `pipelines`: a map of pipeline configs (keyed by pipeline id)
 *
 * `outputs` and `reports` in {@link ModelConverterRequest | ModelConverterRequest}
 * are currently required by the type, but the converter does not
 * write files to disk. Converted data is returned on
 * {@link ModelConverterResult.outputs | ModelConverterResult.outputs}.
 *
 * ## DotBIM to XGF and DataModelParams JSON
 *
 * ### Imports
 *
 * ````ts
 * import { readFile, writeFile } from "fs/promises";
 *
 * import { ModelConverter, type ModelConverterRequest } from "@xeokit/sdk/conversion/pipeline";
 * import { DotBIMLoader } from "@xeokit/sdk/formats/dotbim";
 * import { XGFExporter } from "@xeokit/sdk/formats/xgf";
 * import { DataModelExporter } from "@xeokit/sdk/model/data";
 * ````
 *
 * ### Converter setup
 *
 * This pipeline reads a DotBIM input and returns XGF plus
 * DataModelParams JSON outputs.
 *
 * ````ts
 * const pipeline = new ModelConverter({
 *   loaders: {
 *     dotbim: new DotBIMLoader()
 *   },
 *   exporters: {
 *     xgf: new XGFExporter(),
 *     datamodel: new DataModelExporter()
 *   },
 *   pipelines: {
 *     dotbim2xgf: {
 *       inputs: {
 *         dotbim: {
 *           loader: "dotbim",
 *           options: {}
 *         }
 *       },
 *       outputs: {
 *         xgf: {
 *           exporter: "xgf",
 *           version: "1.0",
 *           options: {}
 *         },
 *         datamodel: {
 *           exporter: "datamodel",
 *           version: "1.0",
 *           options: {}
 *         }
 *       }
 *     }
 *   }
 * });
 * ````
 *
 * ### Conversion
 *
 * Inputs can use `fileData` or `filePath`. Outputs are returned in
 * {@link ModelConverterResult.outputs | result.outputs}.
 *
 * ````ts
 * const dotBIMFileData = JSON.parse(await readFile("model.bim", "utf-8"));
 *
 * const request: ModelConverterRequest = {
 *   pipeline: "dotbim2xgf",
 *   inputs: {
 *     dotbim: { fileData: dotBIMFileData }
 *     // Alternative:
 *     // dotbim: { filePath: "model.bim" }
 *   }
 * };
 *
 * const result = await pipeline.convert(request);
 *
 * const xgfOutput = result.outputs.xgf;
 * const datamodelOutput = result.outputs.datamodel;
 *
 * await writeFile("model.xgf", xgfOutput.fileData);
 *
 * await writeFile("model.json", JSON.stringify(datamodelOutput.fileData, null, 2), "utf-8");
 * ````
 *
 * ## XGF and DataModelParams JSON to DotBIM
 *
 * ### Imports
 *
 * ````ts
 * import { readFile, writeFile } from "fs/promises";
 *
 * import { ModelConverter, type ModelConverterRequest } from "@xeokit/sdk/conversion/pipeline";
 * import { DotBIMExporter } from "@xeokit/sdk/formats/dotbim";
 * import { XGFLoader } from "@xeokit/sdk/formats/xgf";
 * import { DataModelImporter } from "@xeokit/sdk/model/data";
 * ````
 *
 * ### Converter setup
 *
 * This pipeline reads XGF and DataModelParams inputs, then exports
 * DotBIM.
 *
 * ````ts
 * const pipeline = new ModelConverter({
 *   loaders: {
 *     xgf: new XGFLoader(),
 *     datamodel: new DataModelImporter()
 *   },
 *   exporters: {
 *     dotbim: new DotBIMExporter()
 *   },
 *   pipelines: {
 *     xgf2dotbim: {
 *       inputs: {
 *         xgf: {
 *           loader: "xgf",
 *           sceneModel: "mySceneModel",
 *           options: {}
 *         },
 *         datamodel: {
 *           loader: "datamodel",
 *           dataModel: "myDataModel",
 *           options: {}
 *         }
 *       },
 *       outputs: {
 *         dotbim: {
 *           exporter: "dotbim",
 *           sceneModel: "mySceneModel",
 *           dataModel: "myDataModel",
 *           version: "1.1",
 *           options: {}
 *         }
 *       }
 *     }
 *   }
 * });
 * ````
 *
 * ### Conversion
 *
 * ````ts
 * const xgfFileData = await readFile("model.xgf");
 * const datamodelFileData = JSON.parse(await readFile("model.json", "utf-8"));
 *
 * const request: ModelConverterRequest = {
 *   pipeline: "xgf2dotbim",
 *   inputs: {
 *     xgf: { fileData: xgfFileData },
 *     datamodel: { fileData: datamodelFileData }
 *   }
 * };
 *
 * const result = await pipeline.convert(request);
 *
 * await writeFile("model.bim", result.outputs.dotbim.fileData, "utf-8");
 * ````
 *
 * ## Shared Models Across Inputs and Outputs
 *
 * Use `sceneModel` / `dataModel` ids to make multiple inputs populate the same models,
 * and multiple outputs export from those same models.
 *
 * ````ts
 * import type { ModelConverterRequest } from "@xeokit/sdk/conversion/pipeline";
 *
 * const pipeline = new ModelConverter({
 *   loaders: {
 *     xgf: new XGFLoader(),
 *     datamodel: new DataModelImporter()
 *   },
 *   exporters: {
 *     xgf: new XGFExporter(),
 *     datamodel: new DataModelExporter()
 *   },
 *   pipelines: {
 *     roundTripLike: {
 *       inputs: {
 *         geom:   { loader: "xgf", sceneModel: "main", dataModel: "main" },
 *         props:  { loader: "datamodel", dataModel: "main" }
 *       },
 *       outputs: {
 *         outGeom:  { exporter: "xgf", sceneModel: "main", dataModel: "main", version: "1.0" },
 *         outProps: { exporter: "datamodel", dataModel: "main", version: "1.0" }
 *       }
 *     }
 *   }
 * });
 *
 * const request: ModelConverterRequest = {
 *   pipeline: "roundTripLike",
 *   inputs: {
 *     geom:  { filePath: "model.xgf" },
 *     props: { filePath: "model.json" }
 *   }
 * };
 *
 * const result = await pipeline.convert(request);
 *
 * await writeFile("out/model.xgf", result.outputs.outGeom.fileData);
 * await writeFile("out/model.json", JSON.stringify(result.outputs.outProps.fileData, null, 2), "utf-8");
 * ````
 *
 * @module pipeline
 */
export * from "./ModelConverter";
export * from "./ModelConverterParams";
export * from "./ModelConverterPipelineConfig";
export * from "./ModelConverterInspectConfig";
export * from "./ModelConverterInputConfig";
export * from "./ModelConverterOutputConfig";

export * from "./ModelConverterConfig";

export * from "./ModelConverterRequest";
export * from "./ModelConverterResult";
export * from "./ModelConverterResultInput";
export * from "./ModelConverterResultInspection";
export * from "./ModelConverterResultOutput";

export * as reporters from "./reporters"
// export * as exporters from "./exporters";
