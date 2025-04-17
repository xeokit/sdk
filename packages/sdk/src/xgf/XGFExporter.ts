import {encode as encode_1_0_0} from "./versions/v1/encode"
import {Exporter} from "../io";

/**
 * Exports a {@link scene!SceneModel | SceneModel} to an XGF file.
 */
export class XGFExporter extends Exporter {
    constructor() {
        super({
            fileDataType: "json",
            encoders: {
                "1.0.0": encode_1_0_0
            },
            defaultVersion: "1.0.0"
        });
    }
}
