/**
 * Represents metadata and diagnostic information for a single output
 * generated in the model conversion process.
 */
export interface ModelConverterStatsReportOutput {

  /**
   * The absolute or relative path to the output file.
   */
  filePath: string;

  /**
   * The format of the output file (e.g., "glTF", "IFC", "DotBIM").
   */
  fileFormat: string;

  /**
   * The version of the file format used for the output.
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
   *
   * Keys are typically CLI flags or processing options, and values may vary in type.
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
   * Informational messages generated during processing of this output.
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
