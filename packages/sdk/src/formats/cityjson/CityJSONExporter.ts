import {encode as encode_1_0} from "./versions/v1_0/encode";
import {ModelExporter} from "../ModelExporter";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} (and optional
 * {@link model!data.DataModel | DataModel}) to CityJSON — the inverse of
 * {@link CityJSONLoader}.
 *
 * For detailed usage, refer to {@link cityjson | @xeokit/sdk/formats/cityjson}.
 */
export class CityJSONExporter extends ModelExporter {
  constructor() {
    super({
      format: "CityJSON",
      fileDataType: "json",
      encoders: {
        "1.0": encode_1_0
      },
      defaultVersion: "1.0"
    });
  }
}
