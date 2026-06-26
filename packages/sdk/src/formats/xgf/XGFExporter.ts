import {encode} from "./versions/v1/encode";
import {ModelExporter} from "../ModelExporter";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} to an XGF file.
 *
 * For detailed usage, refer to {@link xgf | @xeokit/sdk/formats/xgf}.
 *
 * XGF carries the full visual model: geometry (positions, normals, UVs,
 * per-vertex colours, indices, edge indices, AABBs, modelling matrices), 3D
 * Gaussian Splatting geometry (per-splat scales + rotation quaternions), PBR
 * materials with textures (image bytes + sampler params + colour-space
 * encoding), per-material `triplanarScale`, and objects referencing meshes.
 */
export class XGFExporter extends ModelExporter {
  constructor() {
    super({
      format: "XGF",
      fileDataType: "arraybuffer",
      encoders: {
        "1.0.0": encode
      },
      defaultVersion: "1.0.0"
    });
  }
}
