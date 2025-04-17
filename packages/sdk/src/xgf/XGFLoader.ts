import {Loader} from "../io";
import {parse as parse_v1} from "./versions/v1/parse"

/**
 * Loads an XGF file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 */
export class XGFLoader extends Loader {
    constructor() {
        super({
            fileDataType: "arraybuffer",
            parsers: {
                "1": parse_v1
            },
            getVersion: (fileData: any): string => {
                return "" + (new DataView(fileData)).getUint32(0, true);
            }
        });
    }
}

