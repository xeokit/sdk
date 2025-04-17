import {encode as encode_1_0} from "./versions/1_0/encode"
import {Exporter} from "../io";

/**
 * Writes a {@link data!DataModel | DataModel} to {@link DataModelParams | DataModelParams} as JSON.
 */
export class DataModeParamsExporter extends Exporter {

    /**
     * Constructs a DataModeParamsExporter.
     */
    constructor() {
        super({
            fileDataType: "json",
            encoders: {
                "1.0": encode_1_0
            },
            defaultVersion: "1.0"
        });
    }
}
