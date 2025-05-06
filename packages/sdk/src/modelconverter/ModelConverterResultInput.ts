/**
 * Represents a single input file read by the {@link ModelConverter.convert | ModelConverter.convert} method.
 */
export interface ModelConverterResultInput {

  /**
   * Path the file data was read from, if applicable.
   */
  filePath?: string;

  /**
   * The file data.
   */
  fileData: any;

  /**
   * The type of data returned in `fileData`.
   *
   * Supported values:
   * - `"json"` — a structured JavaScript object
   * - `"arraybuffer"` — raw binary data
   */
  fileDataType: string;

  /**
   *
   */
  fileDataSizeBytes: number;

  /**
   *
   */
  fileFormat: string;

  /**
   * The schema version applied when generating this input.
   */
  fileFormatVersion?: string;

  /**
   * Format-specific parsing options.
   */
  options: { [key: string]: any };

  /**
   * The {@link scene!SceneModel | SceneModel} used during export.
   *
   * This object is managed internally and valid only within the scope of {@link ModelConverter.convert}.
   */
  sceneModel: string;

  /**
   * The {@link data!DataModel | DataModel} used during export.
   *
   * This object is managed internally and valid only within the scope of {@link ModelConverter.convert}.
   */
  dataModel: string;

  messages: string[];

  warnings: string[];

  errors: string[];
}
