import {encode as encode_1_0_0} from "./versions/1_0_0/encode"
import {encode as encode_1_1_0} from "./versions/1_1_0/encode"
import {ModelExporter} from "../io";

/**
 * Exports a {@link scene!SceneModel | SceneModel} and a {@link data!DataModel | DataModel} to .BIM format.
 *
 * For detailed usage, refer to {@link dotbim | @xeokit/sdk/dotbim}.
 */
export class DotBIMExporter extends ModelExporter {
  constructor() {
    super({
      format: "DotBIM",
      fileDataType: "json",
      encoders: {
        "1.0.0": encode_1_0_0,
        "1.1.0": encode_1_1_0
      },
      defaultVersion: "1.1.0"
    });
  }
}
