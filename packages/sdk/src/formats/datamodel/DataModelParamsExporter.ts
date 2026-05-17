import {encode as encode_1_0} from "./versions/1_0/encode"
import {ModelExporter} from "../ModelExporter";

/**
 * Writes a {@link model!data.DataModel | DataModel} to {@link model!data.DataModelParams | DataModelParams} as JSON.
 */
export class DataModelParamsExporter extends ModelExporter {

  /**
   * Constructs a DataModelParamsExporter.
   */
  constructor() {
    super({
      format: "DataModelParams",
      fileDataType: "json",
      encoders: {
        "1.0": encode_1_0
      },
      defaultVersion: "1.0"
    });
  }
}
