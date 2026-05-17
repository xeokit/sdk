import {encode as encode_1_0} from "./versions/v1_0/encode";
import {ModelExporter} from "../ModelExporter";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} to OBJ format.
 *
 * For detailed usage, refer to {@link obj | @xeokit/sdk/formats/obj}.
 */
export class OBJExporter extends ModelExporter {
  constructor() {
    super({
      format: "OBJ",
      fileDataType: "text",
      encoders: {
        "1.0": encode_1_0
      },
      defaultVersion: "1.0"
    });
  }
}
