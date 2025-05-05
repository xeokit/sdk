
import { ModelConverterManifestReport } from "./ModelConverterManifestReport";
import { ModelConverterReportParams } from "../ModelConverterReportParams";
import { ModelConverterManifestReportFile } from "./ModelConverterManifestReportFile";
import {ModelConverterResult} from "../../ModelConverterResult";

/**
 * Generates a model converter manifest report. The report contains metadata
 * about the files involved in the conversion, including their paths, formats, sizes, and options.
 *
 * This function determines the files to include in the report based on the presence of outputs
 * or inputs, and returns a populated {@link ModelConverterManifestReport | ModelConverterManifestReport}.
 *
 * @param modelConverterResult - The model converter result.
 * @returns A populated {@link ModelConverterManifestReport | ModelConverterManifestReport} object.
 */
export const createModelConverterManifestReport: (modelConverterResult: ModelConverterResult) => ModelConverterManifestReport = (modelConverterResult:ModelConverterResult): ModelConverterManifestReport => {
    return {
        files: getEntries(modelConverterResult)
    }
}

/**
 * Helper function that extracts file entries for the manifest report.
 *
 * Depending on whether outputs exist in the model converter result, this function either catalogs
 * the output files or defaults to the input files. Each entry includes file metadata and AABB information.
 *
 * @param modelConverterResult - The parameters that include the model converter result and scene data.
 * @returns An object mapping file identifiers to their respective metadata {@link ModelConverterManifestReportFile | ModelConverterManifestReportFile}.
 */
function getEntries(modelConverterResult: ModelConverterResult): { [key: string]: ModelConverterManifestReportFile } {
    const entries = {};

    // Determine which files to catalog: outputs if they exist, otherwise inputs
    const inputEntries = (Object.keys(modelConverterResult.outputs).length === 0)
        ? modelConverterResult.inputs // Case 1: Cataloging files without converting anything
        : modelConverterResult.outputs;

    // Iterate through the selected entries (inputs or outputs)
    for (let id in inputEntries) {
        const inputEntry = inputEntries[id];

        // Populate the report with file details, including AABB if available
        entries[id] = {
            filePath: inputEntry.filePath,
            fileFormat: inputEntry.fileFormat,
            fileFormatVersion: inputEntry.fileFormatVersion,
            fileDataSizeBytes: inputEntry.fileDataSizeBytes,
            fileDataType: inputEntry.fileDataType,
            options: inputEntry.options,
            aabb: Array.from(Array.from(modelConverterResult.scene.models[inputEntry.sceneModel].aabb || [0, 0, 0, 0, 0, 0]))
        };
    }

    return entries;
}
