import {encode as encode_1_1_0} from "./versions/1_1_0/encode"
import {Exporter} from "../io";

/**
 * Exports a {@link scene!SceneModel | SceneModel} and a {@link data!DataModel | DataModel} to .BIM format.
 */
export class DotBIMExporter extends Exporter {
    constructor() {
        super({
            fileDataType: "json",
            encoders: {
                "1.1.0": encode_1_1_0
            },
            defaultVersion: "1.1.0"
        });
    }
}
