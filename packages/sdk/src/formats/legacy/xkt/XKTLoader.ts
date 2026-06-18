import {ModelLoader} from "../../ModelLoader";
import {parse as parse_v12} from "./versions/v12/parse";

/**
 * Loads a xeokit v2 XKT file into a {@link model!scene.SceneModel | SceneModel}
 * and/or a {@link model!data.DataModel | DataModel}.
 *
 * Supports XKT version 12 (the latest), in its uncompressed offset-table
 * container. For detailed usage, refer to {@link xkt | @xeokit/sdk/formats/xkt}.
 */
export class XKTLoader extends ModelLoader {
  constructor() {
    super({
      format: "XKT",
      fileDataType: "arraybuffer",
      parsers: {
        "12": parse_v12,
      },
      getVersion: (fileData: any): string => {
        return "" + new DataView(fileData).getUint32(0, true);
      },
    });
  }
}
