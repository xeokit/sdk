import { ModelConverterReporter } from "../ModelConverterReporter";
import { ModelConverterStatsReport } from "./ModelConverterStatsReport";
import {ModelConverterResult} from "../../ModelConverterResult";

/**
 * Generates a detailed report on the model conversion process, including statistics
 * about the input, output, scene models, and data models.
 *
 * This report captures metadata about the conversion, such as the command run, the pipeline used,
 * and specific details about the inputs and outputs. It is primarily intended for internal use or debugging.
 *
 * @param modelConverterResult - The parameters for generating the report, which include the model converter and result data.
 * @returns A populated {@link ModelConverterStatsReport | ModelConverterStatsReport} containing conversion statistics.
 */
export const createModelConverterStatsReport: ModelConverterReporter = (modelConverterResult:ModelConverterResult): ModelConverterStatsReport => {

    const modelConverter = modelConverterResult.modelConverter;
    const pipelineId = modelConverterResult.pipeline;
    const pipeline = modelConverter.pipelines[pipelineId];

    const modelConverterStatsReport: ModelConverterStatsReport = {
        description: "xeoconvert conversion stats",
        command: `node xeoconvert.js ${process.argv.slice(2).join(' ')}`,
        time: (new Date()).toISOString(), // "2025-04-23T18:30:00.000Z"
        pipeline: modelConverterResult.pipeline,
        inputs: {},
        sceneModels: {},
        dataModels: {},
        outputs: {}
    };

    // Iterate over all inputs in the conversion result and populate the report
    for (const inputId in modelConverterResult.inputs) {
        const input = modelConverterResult.inputs[inputId];
        modelConverterStatsReport.inputs[inputId] = {
            filePath: input.filePath,
            fileFormat: input.fileFormat,
            fileFormatVersion: input.fileFormatVersion,
            fileDataSizeBytes: input.fileDataSizeBytes,
            fileDataType: input.fileDataType,
            options: input.options || {},
            sceneModel: input.sceneModel || "default",
            dataModel: input.dataModel || "default",
            messages: [],
            warnings: [],
            errors: []
        };
    }

    // Iterate over all outputs in the conversion result and populate the report
    for (const outputId in modelConverterResult.outputs) {
        const outputConfig = pipeline.outputs[outputId];
        const output = modelConverterResult.outputs[outputId];
        modelConverterStatsReport.outputs[outputId] = {
            filePath: output.filePath,
            fileFormat: output.fileFormat,
            fileFormatVersion: output.fileFormatVersion,
            fileDataSizeBytes: output.fileDataSizeBytes,
            fileDataType: output.fileDataType,
            options: outputConfig.options || {},
            sceneModel: output.sceneModel || "default",
            dataModel: output.dataModel || "default",
            messages: [],
            warnings: [],
            errors: []
        };
    }

    return modelConverterStatsReport;
}
