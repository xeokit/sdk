import {encode as encode_1_0} from "./versions/v1_0/encode";
import {ModelExporter} from "../ModelExporter";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} to MTL format.
 *
 * For detailed usage, refer to {@link formats!mtl | @xeokit/sdk/formats/mtl}.
 */
export class MTLExporter extends ModelExporter {
  constructor() {
    super({
      format: "MTL",
      fileDataType: "text",
      encoders: {
        "1.0": encode_1_0
      },
      defaultVersion: "1.0"
    });
  }
}
