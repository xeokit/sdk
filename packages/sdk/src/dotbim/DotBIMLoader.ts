import {parse as parse_1_0_0} from "./versions/1_0_0/parse"
import {parse as parse_1_1_0} from "./versions/1_1_0/parse"
import {ModelLoader} from "../io";

/**
 * Loads a .BIM file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link dotbim | @xeokit/sdk/dotbim}.
 */
export class DotBIMLoader extends ModelLoader {
    constructor() {
        super({
            fileDataType: "json",
            parsers: {
                "1.0.0": parse_1_0_0,
                "1.1.0": parse_1_1_0
            },
            getVersion: (sourceFileData: any): string => {
                return sourceFileData.schema_version || "1.0.0";
            }
        });
    }
}


