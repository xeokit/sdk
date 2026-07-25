import {ModelExporter} from "../ModelExporter";
import {encode as encode_1_0} from "./versions/v1_0/encode";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} to ASCII PLY.
 *
 * For detailed usage, refer to {@link ply | @xeokit/sdk/formats/ply}.
 */
export class PLYExporter extends ModelExporter {
  constructor() {
    super({
      format: "PLY",
      fileDataType: "text",
      encoders: {
        "1.0": encode_1_0,
      },
      defaultVersion: "1.0",
    });
  }
}
