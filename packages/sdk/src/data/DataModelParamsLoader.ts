import {parse as parse_1_0} from "./versions/1_0/parse"
import {Loader} from "../io";
import {DataModelParams} from "./DataModelParams";
import {DataModel} from "./DataModel";

/**
 * Reads {@link DataModelParams | DataModelParams} into a {@link DataModel | DataModel}.
 */
export class DataModelParamsLoader extends Loader {

    /**
     * Constructs a DataModelParamsLoader.
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
