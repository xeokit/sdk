import {parse as parse_1_0} from "./versions/1_0/parse"
import {Loader} from "../io";
import {SceneModelParams} from "./SceneModelParams";
import {SceneModel} from "./SceneModel";

/**
 * Reads {@link SceneModelParams | SceneModelParams} into a {@link SceneModel | SceneModel}.
 */
export class SceneModelParamsLoader extends Loader {

    /**
     * Constructs a SceneModelParamsLoader.
     */
    constructor() {
        super({
            fileDataType: "json",
            parsers: {
                "1.0": parse_1_0
            },
            getVersion: (fileData: any): string => {
                return fileData.version || "1.0";
            }
        });
    }
}
