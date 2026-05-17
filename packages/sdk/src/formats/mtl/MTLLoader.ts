import {ModelLoader} from "../ModelLoader";
import {parse as parse_1_0} from "./versions/v1_0/parse"

/**
 * Loads a MTL file into a {@link model!scene.SceneModel | SceneModel}.
 *
 * For detailed usage, refer to {@link mtl | @xeokit/sdk/formats/mtl}.
 */
export class MTLLoader extends ModelLoader {

  /**
   * Constructs a MTLLoader.
   */
  constructor() {
    super({
      format: "MTL",
      fileDataType: "text",
      parsers: {
        "1.0": parse_1_0
      },
      getVersion: (fileData: any): string => {
        return fileData.version || "1.0";
      }
    });
  }
}

