import {XeoConvertReporter} from "../XeoConvertReporter";
import {XeoConvertManifestReport} from "./XeoConvertManifestReport";
import {XeoConvertReportParams} from "../XeoConvertReportParams";
import {XeoConvertManifestReportFile} from "./XeoConvertManifestReportFile";

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
    for (let id in inputEntries) {
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

