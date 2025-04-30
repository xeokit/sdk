import {ModelLoader} from "../io";
import {parse as parse_10} from "./versions/v10/parse";

/**
 * Loads an XKT file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link xkt | @xeokit/sdk/xkt}.
 */
export class XKTLoader extends ModelLoader {

    /**
     * Constructs an XKTLoader.
     */
    constructor() {
        super({
            format: "XKT",
            fileDataType: "arraybuffer",
            parsers: {
                "10": parse_10
            },
            getVersion: (fileData: any): string => {
                return "" + (new DataView(fileData)).getUint32(0, true);
            }
        });
    }
}

