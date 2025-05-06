import {Data} from "../data";
import {Scene} from "../scene";
import {ModelLoader, ModelExporter} from "../io";
import {SDKError} from "../core";
import {type ModelConverterParams} from "./ModelConverterParams";
import {type ModelConverterPipelineParams} from "./ModelConverterPipelineParams";
import {type ModelConverterRequest} from "./ModelConverterRequest";
import {type ModelConverterResult} from "./ModelConverterResult";
import {type ModelConverterConfig} from "./ModelConverterConfig";

import {createFileIO} from "./../io/FileIOFactory";

const fileIO = createFileIO();

/**
 * Transforms 3D model data between different file formats.
 *
 * The `ModelConverter` class manages file format conversions using a set of predefined
 * **loaders** (parsers for input formats) and **exporters** (generators for output formats).
 * It uses **pipelines** to define structured conversion workflows.
 *
 * For detailed usage, refer to {@link modelconverter | @xeokit/sdk/modelconverter}.
 */
export class ModelConverter {

  /**
   * A collection of available loaders, mapped by format identifiers.
   * Each loader is responsible for parsing specific file formats.
   */
  loaders: { [key: string]: ModelLoader };

  /**
   * A collection of available exporters, mapped by format identifiers.
   * Each exporter generates output files in a specific format.
   */
  exporters: { [key: string]: ModelExporter };

  /**
   * A collection of conversion pipelines, indexed by pipeline name.
   * Each pipeline defines how input data is processed and converted into output formats.
   */
  pipelines: { [key: string]: ModelConverterPipelineParams };

  /**
   * Creates a new ModelConverter instance with the provided configuration.
   *
   * @param params - An object containing configured loaders, exporters, and optional pipelines.
   */
  constructor(params: ModelConverterParams) {
    this.loaders = params.loaders || {};
    this.exporters = params.exporters || {};
    this.pipelines = params.pipelines || {};
  }

  /**
   * Transforms 3D model data using a specified conversion pipeline.
   *
   * This method loads the given input file data, constructs scene and data models, and then
   * writes the converted output using the configured exporters.
   *
   * @param modelConverterRequest - The parameters specifying the pipeline and input data.
   * @returns A promise that resolves to a `ModelConverterResult` object containing the output files.
   *
   * @throws {SDKError} If required parameters are missing or if an unsupported pipeline is specified.
   */
  convert(modelConverterRequest: ModelConverterRequest): Promise<ModelConverterResult> {

    return new Promise((resolve, reject) => {

      if (!modelConverterRequest) {
        return reject(`Arguments expected`);
      }

      const pipelineId = modelConverterRequest.pipeline;
      if (!pipelineId) {
        return reject(`Argument expected: pipeline`);
      }

      const pipeline = this.pipelines[pipelineId];
      if (!pipeline) {
        return reject(`Unsupported pipeline: "${pipelineId}" - supported pipelines are [${Object.keys(this.pipelines || {})}]`);
      }

      const conversionParamsInputs = modelConverterRequest.inputs;
      if (!conversionParamsInputs) {
        return reject(`Argument expected: inputs`);
      }

      const pipelineInputs = pipeline.inputs;
      if (!pipelineInputs) {
        return reject(`No inputs defined on pipeline "${pipelineId}"`);
      }

      const pipelineInputIds = Object.keys(pipelineInputs);
      if (pipelineInputIds.length === 0) {
        return reject(`No inputs defined on pipeline "${pipelineId}"`);
      }

      for (let inputId in pipelineInputs) {
        const inputParams = pipelineInputs[inputId];
        const loaderId = inputParams.loader;
        if (!loaderId) {
          return reject(`No loader defined on input "${inputId}" of pipeline "${pipelineId}"`);
        }
        const loader = this.loaders[loaderId];
        if (!loader) {
          return reject(`Can't resolve loader "${loaderId}", referenced by input "${inputId}" of pipeline "${pipelineId}"`);
        }
      }

      const pipelineOutputs = pipeline.outputs || {};
      const pipelineOutputIds = Object.keys(pipelineOutputs);

      for (let outputId in pipelineOutputs) {
        const outputParams = pipelineOutputs[outputId];
        const exporterId = outputParams.exporter;
        if (!exporterId) {
          return reject(`No exporter defined on output "${outputId}" of pipeline "${pipelineId}"`);
        }
        const exporter = this.exporters[exporterId];
        if (!exporter) {
          return reject(`Can't resolve exporter "${exporterId}", referenced by output "${outputId}" of pipeline "${pipelineId}"`);
        }
      }

      const scene = new Scene();
      const data = new Data();

      const modelConverterResult: ModelConverterResult = {
        modelConverter: this,
        pipeline: pipelineId,
        scene,
        data,
        inputs: {},
        outputs: {}
      };

      const processInputs = async () => {
        for (const pipelineInputId of pipelineInputIds) {
          const pipelineInput = pipelineInputs[pipelineInputId];
          const {filePath, fileData} = conversionParamsInputs[pipelineInputId];
          let fileDataSizeBytes;
          const loader = this.loaders[pipelineInput.loader];
          const sceneModelId = pipelineInput.sceneModel || "default";
          const sceneModel = scene.models[sceneModelId] || scene.createModel({id: sceneModelId});
          const dataModelId = pipelineInput.dataModel || "default";
          const dataModel = data.models[dataModelId] || data.createModel({id: dataModelId});
          if (sceneModel instanceof SDKError || dataModel instanceof SDKError) {
            continue;
          }
          const loadFileData = async (fileData) => {

            switch (loader.fileDataType) {
              case "text":
                fileDataSizeBytes = (new TextEncoder()).encode(fileData).length;
                break;
              case "json":
                fileDataSizeBytes = (new TextEncoder()).encode(fileData).length;
                break;
              default:
                fileData = fileIO.load(filePath);
                fileDataSizeBytes = fileData.buffer.byteLength;
                break;
            }

            try {
              await loader.load({filePath, fileData, sceneModel, dataModel});
              modelConverterResult.inputs[pipelineInputId] = {
                filePath,
                fileData,
                fileDataType: loader.fileDataType,
                fileDataSizeBytes,
                fileFormat: loader.format,
                options: pipelineInput.options || {},
                sceneModel: sceneModelId,
                dataModel: dataModelId,
                messages: [],
                warnings: [],
                errors: []
              };
            } catch (err) {
              modelConverterResult.inputs[pipelineInputId] = {
                fileData: null,
                fileDataType: loader.fileDataType,
                fileDataSizeBytes,
                fileFormat: loader.format,
                fileFormatVersion: null,
                options: pipelineInput.options || {},
                sceneModel: sceneModelId,
                dataModel: dataModelId,
                messages: [],
                warnings: [],
                errors: [`Failed to load fileData: ${err}`]
              };
            }
          };

          if (filePath) {
            fileIO.load(filePath).then((fileData) => {
              loadFileData(fileData);
            }).catch(err => {
              reject(`Failed to load source file: ${err}`);
            });

          } else {
            await loadFileData(fileData);
          }
        }
      };

      const buildSceneModels = () => {
        const sceneModelIds = Object.keys(scene.models);
        const buildNextSceneModel = (index = 0) => {
          if (index >= sceneModelIds.length) {
            return;
          }
          const sceneModelId = sceneModelIds[index];
          const sceneModel = scene.models[sceneModelId];
          sceneModel.build().then(() => {
            buildNextSceneModel(index + 1);
          }).catch(errMsg => {
            // reject(`Failed to build SceneModel "${sceneModelId}": ${errMsg}`);
            return;
          });
        }
        buildNextSceneModel(0);
      }

      const buildDataModels = async () => {
        const dataModelIds = Object.keys(data.models);
        try {
          for (const dataModelId of dataModelIds) {
            const dataModel = data.models[dataModelId];
            await dataModel.build();
          }
        } catch (err) {
          // console.error(`❌ Failed to build a DataModel:`, err);
        }
      };

      const processOutputs = async () => {
        for (const pipelineOutputId of pipelineOutputIds) {
          const pipelineOutput = pipelineOutputs[pipelineOutputId];
          const exporter = this.exporters[pipelineOutput.exporter];
          const fileFormatVersion = pipelineOutput.version || exporter.defaultVersion;
          const sceneModelId = pipelineOutput.sceneModel || "default";
          const sceneModel = scene.models[sceneModelId] || scene.createModel({id: sceneModelId});
          const dataModelId = pipelineOutput.dataModel || "default";
          const dataModel = data.models[dataModelId] || data.createModel({id: dataModelId});
          if (sceneModel instanceof SDKError || dataModel instanceof SDKError) {
            continue;
          }
          if (dataModel && !dataModel.built) {
            await dataModel.build();
          }
          if (sceneModel && !sceneModel.built) {
            await sceneModel.build();
          }
          try {
            const fileData = await exporter.write({sceneModel, dataModel});
            let fileDataSizeBytes;
            switch (exporter.fileDataType) {
              case "text":
                fileDataSizeBytes = (new TextEncoder()).encode(fileData).length;
                break;
              case "json":
                fileDataSizeBytes = (new TextEncoder()).encode(fileData).length;
                break;
              default:
                fileDataSizeBytes = fileData.buffer.byteLength;
                break;
            }
            modelConverterResult.outputs[pipelineOutputId] = {
              fileData,
              fileDataType: exporter.fileDataType,
              fileFormat: exporter.format,
              fileFormatVersion,
              fileDataSizeBytes,
              options: pipelineOutput.options || {},
              sceneModel: sceneModel.id,
              dataModel: dataModel.id,
              messages: [],
              warnings: [],
              errors: []
            };
          } catch (err) {
            modelConverterResult.outputs[pipelineOutputId] = {
              fileData: null,
              fileDataType: exporter.fileDataType,
              fileFormat: exporter.format,
              fileFormatVersion,
              fileDataSizeBytes: 0,
              options: pipelineOutput.options || {},
              sceneModel: sceneModel.id,
              dataModel: dataModel.id,
              messages: [],
              warnings: [],
              errors: [`Failed to export fileData: ${err}`]
            };
          }
        }
      };

      // const buildReports = () => {
      //     const reporterIds = modelConverterRequest.reports || [];
      //     for (const reporterId of reporterIds) {
      //         const reporter = this.reporters[reporterId];
      //         if (!reporter) {
      //             continue;
      //         }
      //         const report = reporter({
      //             modelConverterResult
      //         });
      //         modelConverterResult.reports[reporterId] = {
      //             //report,
      //             //filePath
      //         };
      //         if (!report) {
      //             // logError(`Reporter '${reporterId}' failed to generate report.`);
      //             continue;
      //         }
      //         modelConverterResult.reports[reporterId] = {
      //             // Add any metadata if needed
      //         };
      //         const dirName = path.dirname(reportPath);
      //         if (dirName && !fs.existsSync(dirName)) {
      //             fs.mkdirSync(dirName, {recursive: true});
      //         }
      //         // logInfo(`Reporter '${reporterId}' writing report to ${reportPath}`);
      //         fs.writeFileSync(reportPath, JSON.stringify(report, null, 4));
      //     }
      // };

      const runPipeline = async (): Promise<ModelConverterResult> => {
        await processInputs();
        await buildSceneModels();
        await buildDataModels();
        await processOutputs();
        return modelConverterResult;
      };

      runPipeline().then(resolve).catch(reject);
    });
  }

  /**
   * Clears all pipeline configurations within this ModelConverter instance.
   *
   * After calling this method, the converter will not have any conversion pipelines configured.
   * You will need to call `setConfigs` to add new pipelines before calling `convert`.
   */
  clearConfigs() {
    this.pipelines = {};
  }

  /**
   * Configures conversion pipelines for this ModelConverter instance.
   *
   * This method allows updating or adding new conversion pipelines dynamically.
   *
   * @param params - An object containing new pipeline configurations.
   * @returns An `SDKError` if configuration validation fails, otherwise `void`.
   */
  setConfigs(params: ModelConverterConfig): SDKError | void {
    for (let pipelineId in params.pipelines) {
      const pipeline = params.pipelines[pipelineId];
      const pipelineInputs = pipeline.inputs;
      if (!pipelineInputs) {
        return new SDKError(`No inputs defined on pipeline "${pipelineId}"`);
      }
      const pipelineInputIds = Object.keys(pipelineInputs);
      if (pipelineInputIds.length === 0) {
        return new SDKError(`No inputs defined on pipeline "${pipelineId}"`);
      }
      const pipelineOutputs = pipeline.outputs;
      if (!pipelineOutputs) {
        return new SDKError(`No outputs defined on pipeline "${pipelineId}"`);
      }
      const pipelineOutputIds = Object.keys(pipelineOutputs);
      if (pipelineOutputIds.length === 0) {
        return new SDKError(`No outputs defined on pipeline "${pipelineId}"`);
      }
      for (let inputId in pipelineInputs) {
        const inputParams = pipelineInputs[inputId];
        const loaderId = inputParams.loader;
        if (!loaderId) {
          return new SDKError(`No loader defined on input "${inputId}" of pipeline "${pipelineId}"`);
        }
        const loader = this.loaders[loaderId];
        if (!loader) {
          return new SDKError(`Can't resolve loader "${loaderId}" on input "${inputId}" of pipeline "${pipelineId}"`);
        }
      }
      for (let outputId in pipelineOutputs) {
        const outputParams = pipelineOutputs[outputId];
        const exporterId = outputParams.exporter;
        if (!exporterId) {
          return new SDKError(`No exporter defined on output "${outputId}" of pipeline "${pipelineId}"`);
        }
        const exporter = this.exporters[exporterId];
        if (!exporter) {
          return new SDKError(`Can't resolve exporter "${exporterId}" on output "${outputId}" of pipeline "${pipelineId}"`);
        }
      }
    }
    for (let pipelineId in params.pipelines) {
      this.pipelines[pipelineId] = params.pipelines[pipelineId];
    }
  }
}
