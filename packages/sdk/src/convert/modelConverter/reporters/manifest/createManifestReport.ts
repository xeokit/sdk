import {type ModelConverterManifestReport} from "./ModelConverterManifestReport";
import {type ModelConverterManifestReportFile} from "./ModelConverterManifestReportFile";
import {type ModelConverterResult} from "../../ModelConverterResult";

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
export const createManifestReport: (modelConverterResult: ModelConverterResult) => ModelConverterManifestReport = (modelConverterResult: ModelConverterResult): ModelConverterManifestReport => {
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
function getEntries(modelConverterResult: ModelConverterResult):  ModelConverterManifestReportFile[]  {
  const entries = [];
  // Determine which files to catalog: outputs if they exist, otherwise inputs
  const inputEntries = (!modelConverterResult.outputs || Object.keys(modelConverterResult.outputs).length === 0)
    ? modelConverterResult.inputs // Case 1: Cataloging files without converting anything
    : modelConverterResult.outputs;
  for (let id in inputEntries) {
    const inputEntry = inputEntries[id];
    entries.push({
      filePath: (inputEntry.filePath || "").split('/').pop(),
      fileFormat: inputEntry.fileFormat,
      fileFormatVersion: inputEntry.fileFormatVersion,
    //  fileDataSizeBytes: inputEntry.fileDataSizeBytes,
      fileDataType: inputEntry.fileDataType,
      options: inputEntry.options
      //,
      //aabb: Array.from(Array.from(modelConverterResult.scene.models[inputEntry.sceneModel].aabb || [0, 0, 0, 0, 0, 0]))
    });
  }
  return entries;
}
