import {ModelExporter} from "../../ModelExporter";
import {encode as encode_v12} from "./versions/v12/encode";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} (and optional
 * {@link model!data.DataModel | DataModel}) to a xeokit v2 XKT file.
 *
 * Writes XKT version 12 in the uncompressed offset-table container. For
 * detailed usage, refer to {@link xkt | @xeokit/sdk/formats/xkt}.
 */
export class XKTExporter extends ModelExporter {
  constructor() {
    super({
      format: "XKT",
      fileDataType: "arraybuffer",
      encoders: {
        "12": encode_v12,
      },
      defaultVersion: "12",
    });
  }
}
