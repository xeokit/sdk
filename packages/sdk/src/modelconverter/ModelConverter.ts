import {Data} from "../data";
import {Scene} from "../scene";
import {ModelLoader, ModelExporter} from "../io";
import {type ModelConverterParams} from "./ModelConverterParams";
import {type ModelConverterPipelineConfig} from "./ModelConverterPipelineConfig";
import {type ModelConverterRequest} from "./ModelConverterRequest";
import {type ModelConverterResult} from "./ModelConverterResult";
import {type ModelConverterConfig} from "./ModelConverterConfig";

import {createFileIO} from "./../io/FileIOFactory";
import {type ModelLoadOptions} from "../io/ModelLoadOptions";
import {SDKErrorType, type SDKResult} from "../core";

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
  pipelines: { [key: string]: ModelConverterPipelineConfig };

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
   * @throws Will reject the promise if required parameters are missing or if conversion fails.
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
        if (!conversionParamsInputs[inputId]) {
          return reject(`Argument expected for pipeline "${pipelineId}": "${inputId}"`);
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
        outputs: {},
        errors: []
      };

      const processInputs = async () => {

        for (const pipelineInputId of pipelineInputIds) {

          const pipelineInput = pipelineInputs[pipelineInputId];
          const {filePath, fileData} = conversionParamsInputs[pipelineInputId];

          let fileDataSizeBytes;

          const loader = this.loaders[pipelineInput.loader];
          const options = <ModelLoadOptions>pipelineInput.options || {};

          const sceneModelId = pipelineInput.sceneModel || "default";
          let sceneModel = scene.models[sceneModelId];

          if (!sceneModel) {
            const sceneModelResult = scene.createModel({
              id: sceneModelId,
              coordinateSystem: options.coordinateSystem
            });
            if (sceneModelResult.ok === false) {

              // Failure to create a SceneModel or DataModel is unlikely here because it only happens
              // on ID conflicts, or when the Scene/Data are already destroyed, neither of which can occur
              // in this context. We handle the errors nonetheless.
              reject(`[Internal error] Failed to create SceneModel "${sceneModelId}": ${sceneModelResult.error}`);
              return;
            }
            sceneModel = sceneModelResult.value;
          }

          const dataModelId = pipelineInput.dataModel || "default";
          let dataModel = data.models[dataModelId];

          if (!dataModel) {
            const dataModelResult = data.createModel({id: dataModelId});
            if (dataModelResult.ok === false) { // Unlikely
              reject(`[Internal error] Failed to create DataModel "${dataModelId}": ${dataModelResult.error}`);
              return;
            }
            dataModel = dataModelResult.value;
          }

          const loadFileData = async (fileData) => {

            switch (loader.fileDataType) {
              case "text":
                fileDataSizeBytes = (new TextEncoder()).encode(fileData).length;
                break;
              case "json":
                fileDataSizeBytes = (new TextEncoder()).encode(JSON.stringify(fileData)).length;
                break;
              default:
                //   fileData = await fileIO.load(filePath);
                fileDataSizeBytes = fileData.buffer ? fileData.buffer.byteLength : 0;
                break;
            }

            try {

              await loader.load({filePath, fileData, sceneModel, dataModel}, options);

              // Loaded this input into SceneModel/DataModel successfully

              modelConverterResult.inputs[pipelineInputId] = {
                filePath,
                fileData,
                fileDataType: loader.fileDataType,
                fileDataSizeBytes,
                fileFormat: loader.format,
                options,
                sceneModel: sceneModelId,
                dataModel: dataModelId,
                messages: [],
                warnings: [],
                errors: []
              };

            } catch (err) {

              // Error during load into SceneModel/DataModel

              const errorMsg = `Failed to load file data: ${err}`;
              modelConverterResult.errors.push(errorMsg);
              modelConverterResult.inputs[pipelineInputId] = {
                fileData,
                fileDataType: loader.fileDataType,
                fileDataSizeBytes,
                fileFormat: loader.format,
                fileFormatVersion: null,
                options,
                sceneModel: sceneModelId,
                dataModel: dataModelId,
                messages: [],
                warnings: [],
                errors: [errorMsg]
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
      }


      const processOutputs = async () => {

        for (const pipelineOutputId of pipelineOutputIds) {

          const pipelineOutput = pipelineOutputs[pipelineOutputId];
          const exporter = this.exporters[pipelineOutput.exporter];
          const fileFormatVersion = pipelineOutput.version || exporter.defaultVersion;
          const sceneModelId = pipelineOutput.sceneModel || "default";
          const dataModelId = pipelineOutput.dataModel || "default";

          let sceneModel = scene.models[sceneModelId];
          if (!sceneModel) {
            const sceneModelResult = scene.createModel({id: sceneModelId});
            if (sceneModelResult.ok === false) { // Unlikely
              reject(`[Internal error] Failed to create SceneModel "${sceneModelId}": ${sceneModelResult.error}`);
              return;
            }
            sceneModel = sceneModelResult.value;
          }

          let dataModel = data.models[dataModelId];

          if (!dataModel) {
            const dataModelResult = data.createModel({id: dataModelId});
            if (dataModelResult.ok === false) { // Unlikely
              reject(`[Internal error] Failed to create DataModel "${dataModelId}": ${dataModelResult.error}`);
              return;
            }
            dataModel = dataModelResult.value;
          }

          const options = <ModelLoadOptions>pipelineOutput.options || {};

          try {

            const fileData = await exporter.write({sceneModel, dataModel}, options);
            let fileDataSizeBytes;

            switch (exporter.fileDataType) {
              case "text":
                fileDataSizeBytes = (new TextEncoder()).encode(fileData).length;
                break;
              case "json":
                fileDataSizeBytes = (new TextEncoder()).encode(JSON.stringify(fileData)).length;
                break;
              default:
                fileDataSizeBytes = fileData.byteLength;
                break;
            }

            modelConverterResult.outputs[pipelineOutputId] = {
              fileData,
              fileDataType: exporter.fileDataType,
              fileFormat: exporter.format,
              fileFormatVersion,
              fileDataSizeBytes,
              options,
              sceneModel: sceneModel.id,
              dataModel: dataModel.id,
              messages: [],
              warnings: [],
              errors: []
            };

          } catch (err) {

            const errorMsg = `Failed to export fileData: ${err}`;
            modelConverterResult.errors.push(errorMsg);

            modelConverterResult.outputs[pipelineOutputId] = {
              fileData: null,
              fileDataType: exporter.fileDataType,
              fileFormat: exporter.format,
              fileFormatVersion,
              fileDataSizeBytes: 0,
              options,
              sceneModel: sceneModel.id,
              dataModel: dataModel.id,
              messages: [],
              warnings: [],
              errors: [errorMsg]
            };
          }
        }
      }

      const runPipeline = async (): Promise<ModelConverterResult> => {
        await processInputs();
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
  setConfigs(params: ModelConverterConfig): SDKResult<void> {
    for (let pipelineId in params.pipelines) {
      const pipeline = params.pipelines[pipelineId];
      const pipelineInputs = pipeline.inputs;
      if (!pipelineInputs) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `No inputs defined on pipeline "${pipelineId}"`
        };
      }
      const pipelineInputIds = Object.keys(pipelineInputs);
      if (pipelineInputIds.length === 0) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `No inputs defined on pipeline "${pipelineId}"`
        };
      }
      const pipelineOutputs = pipeline.outputs;
      if (!pipelineOutputs) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `No outputs defined on pipeline "${pipelineId}"`
        };
      }
      const pipelineOutputIds = Object.keys(pipelineOutputs);
      if (pipelineOutputIds.length === 0) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `No outputs defined on pipeline "${pipelineId}"`
        };
      }
      for (let inputId in pipelineInputs) {
        const inputParams = pipelineInputs[inputId];
        const loaderId = inputParams.loader;
        if (!loaderId) {
          return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `No loader defined on input "${inputId}" of pipeline "${pipelineId}"`
          };
        }
        const loader = this.loaders[loaderId];
        if (!loader) {
          return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `Can't resolve loader "${loaderId}" on input "${inputId}" of pipeline "${pipelineId}"`
          };
        }
      }
      for (let outputId in pipelineOutputs) {
        const outputParams = pipelineOutputs[outputId];
        const exporterId = outputParams.exporter;
        if (!exporterId) {
          return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `No exporter defined on output "${outputId}" of pipeline "${pipelineId}"`
          };
        }
        const exporter = this.exporters[exporterId];
        if (!exporter) {
          return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `Can't resolve exporter "${exporterId}" on output "${outputId}" of pipeline "${pipelineId}"`
          };
        }
      }
    }
    for (let pipelineId in params.pipelines) {
      this.pipelines[pipelineId] = params.pipelines[pipelineId];
    }
    return {
      ok: true,
      value: undefined
    };
  }
}
