import { ModelLoader } from "../io";
import { parse as parse_1_0 } from "./versions/v1_0/parse"

/**
 * Loads a CityJSON file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link cityjson | @xeokit/sdk/cityjson}.
 */
export class CityJSONLoader extends ModelLoader {

  /**
     * Constructs a CityJSONLoader.
     */
  constructor() {
    super({
      format: "CityJSON",
      fileDataType: "json",
      parsers: {
        "1.0": parse_1_0
      },
      getVersion: (fileData: any): string => {
        return fileData.version || "1.0";
      }
    });
  }
}

