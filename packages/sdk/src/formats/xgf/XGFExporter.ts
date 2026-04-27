import {encode as encode_1_0_0} from "./versions/v1/encode";
import {encode as encode_1_1_0} from "./versions/v2/encode";
import {ModelExporter} from "../ModelExporter";

/**
 * Exports a {@link scene!SceneModel | SceneModel} to an XGF file.
 *
 * For detailed usage, refer to {@link xgf | @xeokit/sdk/formats/xgf}.
 *
 * Versions:
 *   - `"1.0.0"` — geometry + per-mesh inline RGBA only. Default.
 *   - `"1.1.0"` ("XKT2") — adds materials with full PBR + alpha
 *                  mode/cutoff, textures (image bytes + sampler params),
 *                  and per-geometry normals + UVs.
 */
export class XGFExporter extends ModelExporter {
  constructor() {
    super({
      format: "XGF",
      fileDataType: "arraybuffer",
      encoders: {
        "1.0.0": encode_1_0_0,
        "1.1.0": encode_1_1_0
      },
      defaultVersion: "1.0.0"
    });
  }
}
