import {ModelLoader} from "../../ModelLoader";
import {parse as parse_v6} from "./versions/v6/parse";
import {parse as parse_v7} from "./versions/v7/parse";
import {parse as parse_v8} from "./versions/v8/parse";
import {parse as parse_v9} from "./versions/v9/parse";
import {parse as parse_v10} from "./versions/v10/parse";
import {parse as parse_v11} from "./versions/v11/parse";
import {parse as parse_v12} from "./versions/v12/parse";
import {parse as parse_v12_compressed} from "./versions/v12/parseCompressed";

/**
 * Loads a xeokit v2 XKT file into a {@link model!scene.SceneModel | SceneModel}
 * and/or a {@link model!data.DataModel | DataModel}.
 *
 * Supports XKT versions 6 through 12. Versions 6-10 use the deflated container.
 * Version 12 has both a deflated form (header high bit set) and an uncompressed
 * offset-table form; version 11 is uncompressed only. Textures and UVs are not
 * loaded. For detailed usage, refer to {@link formats!xkt | @xeokit/sdk/formats/xkt}.
 */
export class XKTLoader extends ModelLoader {
  constructor() {
    super({
      format: "XKT",
      fileDataType: "arraybuffer",
      parsers: {
        "6": parse_v6,
        "7": parse_v7,
        "8": parse_v8,
        "9": parse_v9,
        "10": parse_v10,
        "11": parse_v11,
        "12": parse_v12,
        "12z": parse_v12_compressed,
      },
      getVersion: (fileData: any): string => {
        // The high bit of word 0 is a compression flag, not part of the
        // version. v12 is the only version with both forms; "12z" routes the
        // deflated form to its own parser.
        const word = new DataView(fileData).getUint32(0, true);
        const version = word & 0x7fffffff;
        return version === 12 && (word >>> 31) === 1 ? "12z" : "" + version;
      },
    });
  }
}
