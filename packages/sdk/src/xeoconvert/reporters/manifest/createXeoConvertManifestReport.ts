import { XeoConvertManifestReport } from "./XeoConvertManifestReport";
import { XeoConvertManifestReportFile } from "./XeoConvertManifestReportFile";
import { XeoConvertReporter } from "../XeoConvertReporter";
import { XeoConvertReportParams } from "../XeoConvertReportParams";

/**
 * @private
 */
export const createXeoConvertManifestReport: XeoConvertReporter = (params: XeoConvertReportParams): XeoConvertManifestReport => {
  return {
    files: getEntries(params)
  }
}

function getEntries(params: XeoConvertReportParams): { [key: string]: XeoConvertManifestReportFile } {
  const entries = {};
  const inputEntries = (Object.keys(params.xeoConvertStatsReport.outputs).length === 0)
    ? params.xeoConvertStatsReport.inputs // Case 1: Cataloging files without converting anything
    : params.xeoConvertStatsReport.outputs;
  for (const id in inputEntries) {
    const inputEntry = inputEntries[id];
    entries[id] = {
      filePath: inputEntry.filePath,
      fileFormat: inputEntry.fileFormat,
      fileFormatVersion: inputEntry.fileFormatVersion,
      fileDataSizeBytes: inputEntry.fileDataSizeBytes,
      fileDataType: inputEntry.fileDataType,
      options: inputEntry.options,
      aabb: Array.from(Array.from(params.modelConverterResult.scene.models[inputEntry.sceneModel].aabb || [0, 0, 0, 0, 0, 0]))
    };
  }
  return entries;

}

