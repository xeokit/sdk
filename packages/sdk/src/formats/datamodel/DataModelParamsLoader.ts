import {DataModel} from "../../data/DataModel";
import {ModelLoader} from "../ModelLoader";
import {parse as parse_1_0} from "./versions/1_0/parse"

/**
 * Reads {@link DataModelParams | DataModelParams} into a {@link DataModel | DataModel}.
 */
export class DataModelParamsLoader extends ModelLoader {

  /**
   * Constructs a DataModelParamsLoader.
   */
  constructor() {
    super({
      format: "DataModelParams",
      fileDataType: "json",
      parsers: {
        "1.0": parse_1_0
      },
      getVersion: (fileData: any): string => {
        return fileData.version || "1.0";
      }
    });
  }
}
