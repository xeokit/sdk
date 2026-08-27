import {ModelLoader} from "../ModelLoader";
import {parse as parseV1} from "./versions/v1/parse";
import {parse as parseV2} from "./versions/v2/parse";

/**
 * Loads an XGF file into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link formats!xgf | @xeokit/sdk/formats/xgf}.
 */
export class XGFLoader extends ModelLoader {

  constructor() {
    super({
      format: "XGF",
      fileDataType: "arraybuffer",
      parsers: {
        "1": parseV1,
        "2": parseV2
      },
      getVersion: (fileData: any): string => "" + new DataView(fileData).getUint32(0, true)
    });
  }
}
