/**
 * Represents a single output file produced by the {@link ModelConverter.convert | ModelConverter.convert} method.
 */
export interface ModelConverterResultOutput {

  /**
   * Path the file data was written to, if applicable.
   */
  filePath?: string;

  /**
   * The converted file data.
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
   * The schema version applied when generating this output.
   */
  fileFormatVersion: string;

  /**
   * Format-specific writing options.
   */
  options: { [key: string]: any };

  /**
   * The {@link model!scene.SceneModel | SceneModel} used during export.
   *
   * This object is managed internally and valid only within the scope of {@link ModelConverter.convert}.
   */
  sceneModel: string;

  /**
   * The {@link model!data.DataModel | DataModel} used during export.
   *
   * This object is managed internally and valid only within the scope of {@link ModelConverter.convert}.
   */
  dataModel: string;

  messages: string[];

  warnings: string[];

  errors: string[];
}
