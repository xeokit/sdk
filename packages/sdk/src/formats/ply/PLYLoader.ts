import {ModelLoader} from "../ModelLoader";
import {parse as parse_1_0} from "./versions/v1_0/parse";

/**
 * Loads ASCII PLY mesh or point-cloud data into a {@link model!scene.SceneModel | SceneModel}.
 *
 * For detailed usage, refer to {@link ply | @xeokit/sdk/formats/ply}.
 */
export class PLYLoader extends ModelLoader {
  constructor() {
    super({
      format: "PLY",
      fileDataType: "text",
      parsers: {
        "1.0": parse_1_0,
      },
      getVersion: (): string => "1.0",
    });
  }
}
