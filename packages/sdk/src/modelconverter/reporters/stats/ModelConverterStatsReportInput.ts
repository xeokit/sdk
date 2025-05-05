/**
 * Represents metadata and diagnostic information for a single input
 * used in the model conversion process.
 */
export interface ModelConverterStatsReportInput {
    /**
     * The absolute or relative path to the input or output file.
     */
    filePath: string;

    /**
     * The format of the file (e.g., "glTF", "IFC", "DotBIM").
     */
    fileFormat: string;

    /**
     * The version of the file format used.
     */
    fileFormatVersion: string;

    /**
     * The raw size of the file data in bytes.
     */
    fileDataSizeBytes: number;

    /**
     * A descriptor indicating the type of data contained in the file
     * (e.g., "arraybuffer", "text", "json").
     */
    fileDataType: string;

    /**
     * A map of configuration options or parameters used during processing.
     */
    options: { [key: string]: any };

    /**
     * The identifier of the associated {@link scene!SceneModel | SceneModel}, if applicable.
     */
    sceneModel: string;

    /**
     * The identifier of the associated {@link data!DataModel | DataModel}, if applicable.
     */
    dataModel: string;

    /**
     * Informational messages generated during processing of this input.
     */
    messages: string[];

    /**
     * Non-critical issues encountered during processing.
     */
    warnings: string[];

    /**
     * Errors encountered during processing that may have caused failure or degraded results.
     */
    errors: string[];
}
