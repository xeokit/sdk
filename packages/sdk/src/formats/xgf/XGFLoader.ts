import {ModelLoader} from "../ModelLoader";
import {parse} from "./versions/v1/parse";

/**
 * Loads an XGF file into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link xgf | @xeokit/sdk/formats/xgf}.
 */
export class XGFLoader extends ModelLoader {
  constructor() {
    super({
      format: "XGF",
      fileDataType: "arraybuffer",
      parsers: {
        "1": parse
      },
      getVersion: (fileData: any): string => "" + new DataView(fileData).getUint32(0, true)
    });
  }
}
