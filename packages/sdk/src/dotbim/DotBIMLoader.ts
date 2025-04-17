import {parse as parse_1_1_0} from "./versions/1_1_0/parse"
import {Loader} from "../io";

/**
 * Loads a .BIM file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 */
export class DotBIMLoader extends Loader {
    constructor() {
        super({
            fileDataType: "json",
            parsers: {
                "1.1.0": parse_1_1_0
            },
            getVersion: (sourceFileData: any): string => {
                return sourceFileData.schema_version || "1.1.0";
            }
        });
    }
}


