import {Data} from "../../model/data";
import {Scene} from "../../model/scene";
import type {ModelLoader, ModelExporter} from "../../formats";
import {type ModelConverterParams} from "./ModelConverterParams";
import {type ModelConverterPipelineConfig} from "./ModelConverterPipelineConfig";
import {type ModelConverterInspectConfig} from "./ModelConverterInspectConfig";
import {type ModelConverterRequest} from "./ModelConverterRequest";
import {type ModelConverterResult} from "./ModelConverterResult";
import {type ModelConverterConfig} from "./ModelConverterConfig";

import {createFileIO} from "../../base/io/FileIOFactory";
import {type ModelLoadOptions} from "../../formats/ModelLoadOptions";
import {type ModelExportOptions} from "../../formats/ModelExportOptions";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {
  resetYieldThrottle,
  setYieldIntervalOverride,
  yieldToHost,
} from "../../base/utils";
import {
  applyFixes,
  inspectSceneModel,
  inspectSceneModelAsync,
  type ApplyFixesResult,
  type InspectionReport,
} from "../../inspect/sceneModel";
import {
  inspectDataModel,
  inspectDataModelAsync,
} from "../../inspect/dataModel";

// Lazily created so merely importing this module doesn't construct a
// FileIO — `createFileIO()` throws in Node, and ModelConverter is
// bundled into the Node-side xeoconvert CLI where the filePath branch
// (the only consumer) is never hit.
let _fileIO: ReturnType<typeof createFileIO> | null = null;
function getFileIO(): ReturnType<typeof createFileIO> {
  return _fileIO ?? (_fileIO = createFileIO());
}

/**
 * Transforms 3D model data between different file formats.
 *
 * The `ModelConverter` class manages file format conversions using a set of predefined
 * **loaders** (parsers for input formats) and **exporters** (generators for output formats).
 * It uses **pipelines** to define structured conversion workflows.
 *
 * For detailed usage, refer to {@link modelConverter | @xeokit/sdk/convert/modelConverter}.
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
        return reject(`[ModelConverter.convert] Arguments expected`);
      }

      const pipelineId = modelConverterRequest.pipeline;
      if (!pipelineId) {
        return reject(`[ModelConverter.convert] Argument expected: pipeline`);
      }

      const pipeline = this.pipelines[pipelineId];
      if (!pipeline) {
        return reject(`[ModelConverter.convert] Unsupported pipeline: "${pipelineId}" - supported pipelines are [${Object.keys(this.pipelines || {})}]`);
      }

      const conversionParamsInputs = modelConverterRequest.inputs;
      if (!conversionParamsInputs) {
        return reject(`[ModelConverter.convert] Argument expected: inputs`);
      }

      const pipelineInputs = pipeline.inputs;
      if (!pipelineInputs) {
        return reject(`[ModelConverter.convert] No inputs defined on pipeline "${pipelineId}"`);
      }

      const pipelineInputIds = Object.keys(pipelineInputs);
      if (pipelineInputIds.length === 0) {
        return reject(`[ModelConverter.convert] No inputs defined on pipeline "${pipelineId}"`);
      }

      for (let inputId in pipelineInputs) {
        const inputParams = pipelineInputs[inputId];
        const loaderId = inputParams.loader;
        if (!loaderId) {
          return reject(`[ModelConverter.convert] No loader defined on input "${inputId}" of pipeline "${pipelineId}"`);
        }
        const loader = this.loaders[loaderId];
        if (!loader) {
          return reject(`[ModelConverter.convert] Can't resolve loader "${loaderId}", referenced by input "${inputId}" of pipeline "${pipelineId}"`);
        }
        if (!conversionParamsInputs[inputId]) {
          return reject(`[ModelConverter.convert] Argument expected for pipeline "${pipelineId}": "${inputId}"`);
        }
      }

      const pipelineOutputs = pipeline.outputs || {};
      const pipelineOutputIds = Object.keys(pipelineOutputs);

      for (let outputId in pipelineOutputs) {
        const outputParams = pipelineOutputs[outputId];
        const exporterId = outputParams.exporter;
        if (!exporterId) {
          return reject(`[ModelConverter.convert] No exporter defined on output "${outputId}" of pipeline "${pipelineId}"`);
        }
        const exporter = this.exporters[exporterId];
        if (!exporter) {
          return reject(`[ModelConverter.convert] Can't resolve exporter "${exporterId}", referenced by output "${outputId}" of pipeline "${pipelineId}"`);
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

      // Request-level signal + yield interval propagate to every
      // pipeline step. The interval is pushed once onto the
      // global override so every `yieldToHost` call inside
      // loaders / exporters / inspectors picks it up without
      // having to thread the value through every options
      // object; the throttle is reset so the first hot-loop
      // iteration yields immediately and the first progress
      // frame paints without lag.
      const requestSignal = modelConverterRequest.signal;
      const requestYieldIntervalMs = modelConverterRequest.yieldIntervalMs;
      const abortError = (): Error =>
        (typeof DOMException !== "undefined"
          ? new DOMException("Aborted", "AbortError")
          : Object.assign(new Error("Aborted"), {name: "AbortError"}));
      const throwIfAborted = (): void => {
        if (requestSignal?.aborted) throw abortError();
      };

      const processInputs = async () => {

        for (const pipelineInputId of pipelineInputIds) {

          throwIfAborted();
          // Yield between input steps so the host can paint /
          // service input between heavyweight per-input loads —
          // each loader is otherwise back-to-back synchronous.
          await yieldToHost(requestSignal);

          const pipelineInput = pipelineInputs[pipelineInputId];
          const {filePath, fileData} = conversionParamsInputs[pipelineInputId];

          let fileDataSizeBytes;

          const loader = this.loaders[pipelineInput.loader];
          // Request-level signal wins over any per-step signal
          // already on the pipeline-config options — cancelling
          // the convert should cancel every step, regardless of
          // what the pipeline author set up.
          const options = <ModelLoadOptions>{
            ...(pipelineInput.options || {}),
            ...(requestSignal ? {signal: requestSignal} : {}),
          };

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
              reject(`[ModelConverter.convert] Failed to create SceneModel "${sceneModelId}": ${sceneModelResult.error}`);
              return;
            }
            sceneModel = sceneModelResult.value;
          }

          const dataModelId = pipelineInput.dataModel || "default";
          let dataModel = data.models[dataModelId];

          if (!dataModel) {
            const dataModelResult = data.createModel({id: dataModelId});
            if (dataModelResult.ok === false) { // Unlikely
              reject(`[ModelConverter.convert] Failed to create DataModel "${dataModelId}": ${dataModelResult.error}`);
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
                // Binary inputs are an ArrayBuffer (or an ArrayBufferView):
                // both expose `byteLength` directly — `.buffer` only exists on
                // views, so the previous `fileData.buffer.byteLength` read 0
                // for the common ArrayBuffer case.
                fileDataSizeBytes = typeof fileData?.byteLength === "number" ? fileData.byteLength : 0;
                break;
            }

            try {

              await loader.load({fileData, sceneModel, dataModel}, options);

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

              const errorMsg = `[ModelConverter.convert] Failed to load file data: ${err}`;
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
            try {
              const loadedFileData = await getFileIO().load(filePath);
              await loadFileData(loadedFileData);
            } catch (err) {
              reject(`[ModelConverter.convert] Failed to load source file: ${err}`);
              return;
            }
          } else {
            await loadFileData(fileData);
          }
        }
      }


      const processOutputs = async () => {

        for (const pipelineOutputId of pipelineOutputIds) {

          throwIfAborted();
          await yieldToHost(requestSignal);

          const pipelineOutput = pipelineOutputs[pipelineOutputId];
          const exporter = this.exporters[pipelineOutput.exporter];
          const fileFormatVersion = pipelineOutput.version || exporter.defaultVersion;
          const sceneModelId = pipelineOutput.sceneModel || "default";
          const dataModelId = pipelineOutput.dataModel || "default";

          let sceneModel = scene.models[sceneModelId];
          if (!sceneModel) {
            const sceneModelResult = scene.createModel({id: sceneModelId});
            if (sceneModelResult.ok === false) { // Unlikely
              reject(`[ModelConverter.convert] Failed to create SceneModel "${sceneModelId}": ${sceneModelResult.error}`);
              return;
            }
            sceneModel = sceneModelResult.value;
          }

          let dataModel = data.models[dataModelId];

          if (!dataModel) {
            const dataModelResult = data.createModel({id: dataModelId});
            if (dataModelResult.ok === false) { // Unlikely
              reject(`[ModelConverter.convert] Failed to create DataModel "${dataModelId}": ${dataModelResult.error}`);
              return;
            }
            dataModel = dataModelResult.value;
          }

          const options = <ModelExportOptions>{
            ...(pipelineOutput.options || {}),
            ...(requestSignal ? {signal: requestSignal} : {}),
          };

          // Collect the exporter's conversion-fidelity warnings (e.g. triplanar
          // textures dropped) for this output's report entry. Kept out of the
          // persisted `options` so the report doesn't serialise a callback.
          const warnings: string[] = [];

          try {

            const fileData = await exporter.write(
              {sceneModel, dataModel},
              {...options, onWarning: (message: string) => warnings.push(message)},
            );
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
              warnings,
              errors: []
            };

          } catch (err) {

            const errorMsg = `[ModelConverter.convert] Failed to export fileData: ${err}`;
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

      const runInspection = async (
        cfg: ModelConverterInspectConfig,
      ): Promise<boolean /* aborted */> => {

        modelConverterResult.inspection = {bySceneModel: {}};
        let aborted = false;

        for (const sceneModelId of Object.keys(scene.models)) {
          throwIfAborted();
          await yieldToHost(requestSignal);

          const sceneModel = scene.models[sceneModelId];
          const t0 = Date.now();

          // `inspectSceneModel` returns a report directly;
          // `inspectSceneModelAsync` returns a promise. `await`
          // resolves both shapes uniformly.
          const report: InspectionReport = await (cfg.async
            ? inspectSceneModelAsync({sceneModel, ...(cfg.checks ?? {})})
            : inspectSceneModel({sceneModel, ...(cfg.checks ?? {})}));

          let fixResult: ApplyFixesResult | undefined;
          let reReport: InspectionReport | undefined;

          // Fix pass only runs on a clean pre-fix report — mutating
          // on top of structural errors masks data corruption.
          if (cfg.fix && report.errors.length === 0) {
            const r = applyFixes({sceneModel, report});
            if (r.ok === false) {
              modelConverterResult.errors.push(
                `[ModelConverter.convert] applyFixes failed for "${sceneModelId}": ${r.error}`);
            } else {
              fixResult = r.value;
              if (cfg.reInspect !== false) {
                reReport = await (cfg.async
                  ? inspectSceneModelAsync({sceneModel, ...(cfg.checks ?? {})})
                  : inspectSceneModel({sceneModel, ...(cfg.checks ?? {})}));
              }
            }
          }

          modelConverterResult.inspection.bySceneModel[sceneModelId] = {
            sceneModel: sceneModelId,
            report,
            fixResult,
            reReport,
            durationMs: Date.now() - t0,
          };

          if ((cfg.failOnErrors !== false) && report.errors.length > 0) {
            modelConverterResult.errors.push(
              `[ModelConverter.convert] Inspection found ${report.errors.length} ` +
              `error(s) in SceneModel "${sceneModelId}"; skipping export.`);
            aborted = true;
          }
        }

        // DataModel validation (validation-only — no fixes). Errors here block
        // export the same way SceneModel errors do, so the converter doubles as
        // a semantic/schema validator.
        const dataModelIds = Object.keys(data.models);
        if (dataModelIds.length > 0) {
          modelConverterResult.inspection.byDataModel = {};
          for (const dataModelId of dataModelIds) {
            throwIfAborted();
            await yieldToHost(requestSignal);

            const dataModel = data.models[dataModelId];
            const t0 = Date.now();
            const dataReport = await (cfg.async
              ? inspectDataModelAsync({dataModel, ...(cfg.dataChecks ?? {})})
              : inspectDataModel({dataModel, ...(cfg.dataChecks ?? {})}));

            modelConverterResult.inspection.byDataModel[dataModelId] = {
              dataModel: dataModelId,
              report: dataReport,
              durationMs: Date.now() - t0,
            };

            if ((cfg.failOnErrors !== false) && dataReport.errors.length > 0) {
              modelConverterResult.errors.push(
                `[ModelConverter.convert] Inspection found ${dataReport.errors.length} ` +
                `error(s) in DataModel "${dataModelId}"; skipping export.`);
              aborted = true;
            }
          }
        }
        return aborted;
      };

      const runPipeline = async (): Promise<ModelConverterResult> => {
        await processInputs();
        await yieldToHost(requestSignal);

        const inspectCfg = pipeline.inspect;
        const blocked = inspectCfg?.enabled ? await runInspection(inspectCfg) : false;
        if (blocked) return modelConverterResult;

        await yieldToHost(requestSignal);
        await processOutputs();
        return modelConverterResult;
      };

      // Push the request's yield interval onto the global
      // override so every `yieldToHost` deep in the parsers /
      // exporters honours it without per-call threading. Reset
      // the throttle so the first hot-loop iteration yields
      // immediately. Restore both in `finally` so nested
      // convert invocations stack cleanly.
      const prevYieldInterval = setYieldIntervalOverride(requestYieldIntervalMs);
      resetYieldThrottle();
      runPipeline()
        .then(resolve, reject)
        .finally(() => setYieldIntervalOverride(prevYieldInterval));
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
          error: `[ModelConverter.setConfigs] No inputs defined on pipeline "${pipelineId}"`
        };
      }
      const pipelineInputIds = Object.keys(pipelineInputs);
      if (pipelineInputIds.length === 0) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[ModelConverter.setConfigs] No inputs defined on pipeline "${pipelineId}"`
        };
      }
      const pipelineOutputs = pipeline.outputs;
      if (!pipelineOutputs) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[ModelConverter.setConfigs] No outputs defined on pipeline "${pipelineId}"`
        };
      }
      const pipelineOutputIds = Object.keys(pipelineOutputs);
      if (pipelineOutputIds.length === 0) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[ModelConverter.setConfigs] No outputs defined on pipeline "${pipelineId}"`
        };
      }
      for (let inputId in pipelineInputs) {
        const inputParams = pipelineInputs[inputId];
        const loaderId = inputParams.loader;
        if (!loaderId) {
          return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[ModelConverter.setConfigs] No loader defined on input "${inputId}" of pipeline "${pipelineId}"`
          };
        }
        const loader = this.loaders[loaderId];
        if (!loader) {
          return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[ModelConverter.setConfigs] Can't resolve loader "${loaderId}" on input "${inputId}" of pipeline "${pipelineId}"`
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
            error: `[ModelConverter.setConfigs] No exporter defined on output "${outputId}" of pipeline "${pipelineId}"`
          };
        }
        const exporter = this.exporters[exporterId];
        if (!exporter) {
          return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[ModelConverter.setConfigs] Can't resolve exporter "${exporterId}" on output "${outputId}" of pipeline "${pipelineId}"`
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
