export interface XeoConvertStatsReportOutput {
    filePath: string;
    fileFormat: string;
    fileFormatVersion: string,
    fileDataSizeBytes: number;
    fileDataType: string;
    options: { [key: string]: any };
    sceneModel: string;
    dataModel: string;
    messages: string[];
    warnings: string[];
    errors: string[];
}
