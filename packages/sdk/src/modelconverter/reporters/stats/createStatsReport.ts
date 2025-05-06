import {type ModelConverterReporter} from "../ModelConverterReporter";
import {type ModelConverterStatsReport} from "./ModelConverterStatsReport";
import {type ModelConverterResult} from "../../ModelConverterResult";

/**
 * Generates a detailed report on the model conversion process, including statistics
 * about the input, output, scene models, and data models.
 *
 * This report captures metadata about the conversion, such as the command run, the pipeline used,
 * and specific details about the inputs and outputs.
 *
 * @param modelConverterResult - The parameters for generating the report, which include the model converter and result data.
 * @returns A populated {@link ModelConverterStatsReport | ModelConverterStatsReport} containing conversion statistics.
 */
export const createStatsReport: ModelConverterReporter = (modelConverterResult: ModelConverterResult): ModelConverterStatsReport => {

  const modelConverterStatsReport: ModelConverterStatsReport = {
    description: "xeoconvert conversion stats",
    command: "",//`node xeoconvert.js ${process.argv.slice(2).join(' ')}`, // TODO
    time: (new Date()).toISOString(), // "2025-04-23T18:30:00.000Z"
    pipeline: modelConverterResult.pipeline,
    inputs: {},
    sceneModels: {},
    dataModels: {},
    outputs: {}
  };

  for (const inputId in modelConverterResult.inputs) {
    const input = modelConverterResult.inputs[inputId];
    modelConverterStatsReport.inputs[inputId] = {
      filePath: input.filePath,
      fileFormat: input.fileFormat,
      fileFormatVersion: input.fileFormatVersion,
      fileDataSizeBytes: input.fileDataSizeBytes,
      fileDataType: input.fileDataType,
      options: input.options,
      sceneModel: input.sceneModel,
      dataModel: input.dataModel,
      messages: input.messages,
      warnings: input.warnings,
      errors: input.errors
    };
  }

  for (const outputId in modelConverterResult.outputs) {
    const output = modelConverterResult.outputs[outputId];
    modelConverterStatsReport.outputs[outputId] = {
      filePath: output.filePath,
      fileFormat: output.fileFormat,
      fileFormatVersion: output.fileFormatVersion,
      fileDataSizeBytes: output.fileDataSizeBytes,
      fileDataType: output.fileDataType,
      options: output.options,
      sceneModel: output.sceneModel,
      dataModel: output.dataModel,
      messages: output.messages,
      warnings: output.warnings,
      errors: output.errors
    };
  }

  return modelConverterStatsReport;
}
