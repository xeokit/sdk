import {Loader} from "../io";
import {parse as parse_10} from "./versions/v10/parse";

/**
 * Loads an XKT file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 */
export class XKTLoader extends Loader {

    /**
     * Constructs an XKTLoader.
     */
    constructor() {
        super({
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

