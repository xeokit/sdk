import {ModelLoader} from "../ModelLoader";
import {isUSDZ} from "./usdzArchive";
import {parse as parse_1_0} from "./versions/v1/parse";

/**
 * Loads Pixar USDZ (`.usdz`) packages into a
 * {@link model!scene.SceneModel | SceneModel}.
 *
 * Unpacks the USDZ ZIP package and decodes its root USD layer — binary
 * Crate (`.usdc`) or ASCII (`.usda`) — with the `tinyusdz` wasm reader,
 * producing geometry, transforms and UsdPreviewSurface materials.
 *
 * **Browser only (v1):** the tinyusdz wasm is built web/worker-only, so
 * loading throws under Node (CLI / headless). Packaged textures and USD
 * animation / skinning / variants are not handled yet — see the module
 * docs.
 */
export class USDZLoader extends ModelLoader {

  /**
   * Constructs a USDZLoader.
   */
  constructor() {
    super({
      format: "usdz",
      fileDataType: "arraybuffer",
      parsers: {
        "1.0": parse_1_0,
      },
      getVersion: (fileData: any): string => isUSDZ(fileData) ? "1.0" : "",
    });
  }
}
