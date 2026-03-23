import {ModelLoader} from "../ModelLoader";
import {parse as parse_1_0} from "./versions/v1_0/parse"

/**
 * Loads a OBJ file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link obj | @xeokit/sdk/formats/obj}.
 */
export class OBJLoader extends ModelLoader {

  /**
   * Constructs a OBJLoader.
   */
  constructor() {
    super({
      format: "OBJ",
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

