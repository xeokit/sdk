import {encode as encode_1_0_0} from "./versions/v1/encode"
import {ModelExporter} from "../io";

/**
 * Exports a {@link scene!SceneModel | SceneModel} to an XGF file.
 *
 * For detailed usage, refer to {@link xgf | @xeokit/sdk/xgf}.
 */
export class XGFExporter extends ModelExporter {
    constructor() {
        super({
            fileDataType: "arraybuffer",
            encoders: {
                "1.0.0": encode_1_0_0
            },
            defaultVersion: "1.0.0"
        });
    }
}
