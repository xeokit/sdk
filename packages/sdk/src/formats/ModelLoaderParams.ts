import type {ModelParser} from "./ModelParser";

/**
 * Constructor parameters for a {@link ModelLoader}.
 */
export interface ModelLoaderParams {

  /**
   * The loaded file format.
   */
  format: string;

  /**
   * Parsers for exported schema versions.
   */
  parsers: {
    [key: string]: ModelParser;
  };

  /**
   * Data type of the imported file data.
   */
  fileDataType: string;

  /**
   * Callback which attempts to get the schema version of the given file data.
   */
  getVersion: (fileData: any) => string;
}
