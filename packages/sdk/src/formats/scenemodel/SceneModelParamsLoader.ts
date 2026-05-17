import {ModelLoader } from "../ModelLoader";
import {parse as parse_1_0} from "./versions/1_0/parse"
import {SceneModel} from "../../model/scene/SceneModel";

/**
 * Reads {@link model!scene.SceneModelParams | SceneModelParams} into a {@link model!scene.SceneModel | SceneModel}.
 */
 export class SceneModelParamsLoader extends ModelLoader {

  /**
   * Constructs a SceneModelParamsLoader.
   */
  constructor() {
    super({
      format: "SceneModelParams",
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

