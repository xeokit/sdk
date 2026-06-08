import {ModelExporter} from "../ModelExporter";
import {encode as encode_1_0} from "./versions/v1/encode";

/**
 * Writes a {@link model!scene.SceneModel | SceneModel} to a Pixar USDZ
 * (`.usdz`) package.
 *
 * Emits an ASCII USD (`.usda`) root layer wrapped in a stored,
 * 64-byte-aligned ZIP. Unlike {@link USDZLoader} (which needs the
 * browser-only tinyusdz wasm to read binary Crate), the exporter is pure
 * JS and runs anywhere — Node included.
 *
 * v1 writes mesh geometry (points, triangles, normals), per-mesh
 * transforms, and UsdPreviewSurface materials (base colour, opacity,
 * metallic, roughness). Textures, instancing via USD references, and
 * binary `.usdc` output are not covered yet.
 */
export class USDZExporter extends ModelExporter {

  /**
   * Constructs a USDZExporter.
   */
  constructor() {
    super({
      format: "usdz",
      fileDataType: "arraybuffer",
      encoders: {
        "1.0": encode_1_0,
      },
      defaultVersion: "1.0",
    });
  }
}
