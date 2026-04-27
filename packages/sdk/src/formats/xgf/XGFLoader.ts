import  {ModelLoader} from "../ModelLoader";
import {parse as parse_v1} from "./versions/v1/parse"
import {parse as parse_v2} from "./versions/v2/parse"

/**
 * Loads an XGF file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link xgf | @xeokit/sdk/formats/xgf}.
 */
export class XGFLoader extends ModelLoader {
  constructor() {
    super({
      format: "XGF",
      fileDataType: "arraybuffer",
      parsers: {
        "1": parse_v1,
        "2": parse_v2
      },
      getVersion: (fileData: any): string => {
        return "" + (new DataView(fileData)).getUint32(0, true);
      }
    });
  }
}

