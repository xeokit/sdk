import {encode as encode_1_0_0} from "./versions/v1/encode";
import {encode as encode_1_1_0} from "./versions/v2/encode";
import {encode as encode_1_2_0} from "./versions/v3/encode";
import {ModelExporter} from "../ModelExporter";
import type {ModelExportParams} from "../ModelExportParams";
import type {ModelExportOptions} from "../ModelExportOptions";
import {GaussianSplatsPrimitive} from "../../base/constants";

/** XGF version that first carries Gaussian-splat geometry. */
const SPLAT_CAPABLE_VERSION = "1.2.0";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} to an XGF file.
 *
 * For detailed usage, refer to {@link xgf | @xeokit/sdk/formats/xgf}.
 *
 * Versions:
 *   - `"1.0.0"` — geometry + per-mesh inline RGBA only. Default.
 *   - `"1.1.0"` ("XKT2") — adds materials with full PBR + alpha
 *                  mode/cutoff, textures (image bytes + sampler params),
 *                  and per-geometry normals + UVs.
 *   - `"1.2.0"` — adds 3D Gaussian Splatting geometry (per-splat scales +
 *                  rotation quaternions). Auto-selected when the SceneModel
 *                  contains {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}
 *                  geometry and no explicit `version` was requested, so splats
 *                  are never silently dropped.
 */
export class XGFExporter extends ModelExporter {
  constructor() {
    super({
      format: "XGF",
      fileDataType: "arraybuffer",
      encoders: {
        "1.0.0": encode_1_0_0,
        "1.1.0": encode_1_1_0,
        "1.2.0": encode_1_2_0
      },
      defaultVersion: "1.0.0"
    });
  }

  /**
   * Exports the SceneModel to XGF. Promotes the target version to
   * {@link SPLAT_CAPABLE_VERSION | v3} when the model contains Gaussian-splat
   * geometry and the caller didn't pin a `version` — older versions have no
   * splat buffers, so this prevents splats being silently dropped. An explicit
   * `version` always wins (so callers can still force v1/v2 deliberately).
   */
  write(params: ModelExportParams, options: ModelExportOptions = {}): Promise<any> {
    if (params && !params.version && params.sceneModel?.containsPrimitive(GaussianSplatsPrimitive)) {
      params = {...params, version: SPLAT_CAPABLE_VERSION};
    }
    return super.write(params, options);
  }
}
