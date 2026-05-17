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
 * <br>
 *
 * ## Features
 *
 * - **Multi-format ingest** — register any
 *   {@link formats!ModelLoader | ModelLoader} (DotBIM, IFC, glTF,
 *   LAZ, …) and the converter wires it into the pipeline.
 * - **Multi-format export** — same for
 *   {@link formats!ModelExporter | ModelExporter}s (XGF, DotBIM,
 *   DataModel JSON, …).
 * - **Declarative pipelines** — `pipelines.X = { inputs, outputs }`
 *   pre-binds a named conversion (e.g. `dotbim2xgf`); the runtime
 *   resolves which loader / exporter to use from the registered
 *   maps.
 * - **Reports** — per-conversion `inspection` (validation
 *   findings), `manifest` (file inventory), and `stats` (timings,
 *   counts, sizes) reports are emitted alongside the outputs for
 *   downstream tooling.
 * - **Programmatic API + CLI** — same converter wraps inside the
 *   {@link convert!xeoconvert | xeoconvert} CLI binary; use either
 *   the class directly in a build pipeline or the binary from a
 *   shell script.
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
 * ## Using the ModelConverter class
 *
 * The {@link ModelConverter | ModelConverter} manages conversions using:
 *
 * - **{@link formats!ModelLoader | ModelLoaders}**: parse/ingest input formats into a {@link model!scene.Scene | Scene} / {@link model!data.Data | Data}
 * - **{@link formats!ModelExporter | ModelExporters}**: generate output formats from those models
 * - **Pipelines**: declarative workflows wiring inputs to outputs
 *
 * You configure the converter with {@link ModelConverterParams | ModelConverterParams}:
 *
 * - `loaders`: a map of loader instances (keyed by id)
 * - `exporters`: a map of exporter instances (keyed by id)
 * - `pipelines`: a map of pipeline configs (keyed by pipeline id)
 *
 * > Note: `outputs` and `reports` in {@link ModelConverterRequest | ModelConverterRequest} are currently required by the type,
 * > but the converter does not automatically write files to disk. The converted file data is returned on
 * > {@link ModelConverterResult.outputs | ModelConverterResult.outputs}, and it’s up to you to persist it (e.g., using `fs.writeFile`).
 *
 * <br>
 *
 * ## Converting a DotBIM file to XGF and DataModelParams JSON
 *
 * ### 1) Import dependencies
 *
 * ````ts
 * import { readFile, writeFile } from "fs/promises";
 *
 * import { ModelConverter, type ModelConverterRequest } from "@xeokit/sdk/convert/modelConverter";
 * import { DotBIMLoader } from "@xeokit/sdk/formats/dotbim";
 * import { XGFExporter } from "@xeokit/sdk/formats/xgf";
 * import { DataModelParamsExporter } from "@xeokit/sdk/model/data";
 * ````
 *
 * ### 2) Set up the converter
 *
 * Create a {@link ModelConverter | ModelConverter} configured with loaders/exporters and a `dotbim2xgf` pipeline:
 *
 * - {@link DotBIMLoader} loads `.bim`
 * - {@link XGFExporter} exports `.xgf`
 * - {@link DataModelParamsExporter} exports semantic JSON
 *
 * ````ts
 * const modelConverter = new ModelConverter({
 *   loaders: {
 *     dotbim: new DotBIMLoader()
 *   },
 *   exporters: {
 *     xgf: new XGFExporter(),
 *     datamodel: new DataModelParamsExporter()
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
 * ### 3) Perform the conversion
 *
 * Provide the input via `fileData` (or use `filePath` to let the converter read it).
 * Outputs are returned in {@link ModelConverterResult.outputs | result.outputs}.
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
 * const result = await modelConverter.convert(request);
 *
 * const xgfOutput = result.outputs.xgf;
 * const datamodelOutput = result.outputs.datamodel;
 *
 * // XGF is typically binary (ArrayBuffer)
 * await writeFile("model.xgf", xgfOutput.fileData);
 *
 * // DataModelParams is JSON
 * await writeFile("model.json", JSON.stringify(datamodelOutput.fileData, null, 2), "utf-8");
 * ````
 *
 * <br>
 *
 * ## Converting XGF and DataModelParams JSON back to DotBIM
 *
 * ### 1) Import dependencies
 *
 * ````ts
 * import { readFile, writeFile } from "fs/promises";
 *
 * import { ModelConverter, type ModelConverterRequest } from "@xeokit/sdk/convert/modelConverter";
 * import { DotBIMExporter } from "@xeokit/sdk/formats/dotbim";
 * import { XGFLoader } from "@xeokit/sdk/formats/xgf";
 * import { DataModelParamsLoader } from "@xeokit/sdk/model/data";
 * ````
 *
 * ### 2) Set up the converter
 *
 * Configure loaders for XGF + DataModelParams, and a DotBIM exporter:
 *
 * ````ts
 * const modelConverter = new ModelConverter({
 *   loaders: {
 *     xgf: new XGFLoader(),
 *     datamodel: new DataModelParamsLoader()
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
 * ### 3) Perform the conversion
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
 * const result = await modelConverter.convert(request);
 *
 * await writeFile("model.bim", result.outputs.dotbim.fileData, "utf-8");
 * ````
 *
 * <br>
 *
 * # Advanced usage
 *
 * ## Sharing models across multiple inputs and outputs
 *
 * Use `sceneModel` / `dataModel` ids to make multiple inputs populate the same models,
 * and multiple outputs export from those same models.
 *
 * ````ts
 * import type { ModelConverterRequest } from "@xeokit/sdk/convert/modelConverter";
 *
 * const modelConverter = new ModelConverter({
 *   loaders: {
 *     xgf: new XGFLoader(),
 *     datamodel: new DataModelParamsLoader()
 *   },
 *   exporters: {
 *     xgf: new XGFExporter(),
 *     datamodel: new DataModelParamsExporter()
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
 * const result = await modelConverter.convert(request);
 *
 * await writeFile("out/model.xgf", result.outputs.outGeom.fileData);
 * await writeFile("out/model.json", JSON.stringify(result.outputs.outProps.fileData, null, 2), "utf-8");
 * ````
 *
 * @module modelConverter
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

