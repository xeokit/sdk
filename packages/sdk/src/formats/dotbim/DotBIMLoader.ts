import {ModelLoader} from "../ModelLoader";
import {parse as parse_1_0_0} from "./versions/1_0_0/parse"
import {parse as parse_1_1_0} from "./versions/1_1_0/parse"

/**
 * Loads a .BIM file into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link dotbim | @xeokit/sdk/formats/dotbim}.
 */
export class DotBIMLoader extends ModelLoader {
  constructor() {
    super({
      format: "DotBIM",
      fileDataType: "json",
      parsers: {
        "1.0.0": parse_1_0_0,
        "1.1.0": parse_1_1_0
      },
      getVersion: (sourceFileData: any): string => {
        return sourceFileData.schema_version || "1.0.0";
      }
    });
  }
}


