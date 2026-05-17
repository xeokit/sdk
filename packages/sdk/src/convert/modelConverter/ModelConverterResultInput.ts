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
   * The size of the file data in bytes.
   */
  fileDataSizeBytes: number;

  /**
   * The format of the input file.
   */
  fileFormat: string;

  /**
   * The schema version applied when reading this input.
   */
  fileFormatVersion?: string;

  /**
   * Format-specific parsing options.
   */
  options: { [key: string]: any };

  /**
   * The {@link model!scene.SceneModel | SceneModel} this input was imported into.
   */
  sceneModel: string;

  /**
   * The {@link model!data.DataModel | DataModel} this input was imported into.
   */
  dataModel: string;

  /**
   * Messages produced when reading this input.
   */
  messages: string[];

  /**
   * Warnings produced when reading this input.
   */
  warnings: string[];

  /**
   * Errors produced when reading this input.
   */
  errors: string[];
}
