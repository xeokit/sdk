import {encode as encode_1_0} from "./versions/1_0/encode"
import {Exporter} from "../io";

/**
 * Writes a {@link scene!SceneModel | SceneModel} to {@link SceneModelParams | SceneModelParams} as JSON.
 */
export class SceneModelParamsExporter extends Exporter {

    /**
     * Constructs a SceneModelParamsExporter.
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
