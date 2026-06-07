import {encode as encode_1_0} from "./versions/1_0/encode"
import {ModelExporter} from "../ModelExporter";

/**
 * Writes a {@link model!scene.SceneModel | SceneModel} to {@link model!scene.SceneModelParams | SceneModelParams} as JSON.
 */
export class SceneModelExporter extends ModelExporter {

  /**
   * Constructs a SceneModelExporter.
   */
  constructor() {
    super({
      format: "SceneModelParams",
      fileDataType: "json",
      encoders: {
        "1.0": encode_1_0
      },
      defaultVersion: "1.0"
    });
  }
}
