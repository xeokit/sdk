import {encode as encode_IFC4} from "./versions/IFC4/encode"
import {Exporter} from "../io";

/**
 * Exports a {@link scene!SceneModel | SceneModel} and {@link data!DataModel | DataModel} to an IFC file.
 */
export class IFCExporter extends Exporter {
    constructor() {
        super({
            fileDataType: "json",
            encoders: {
                "IFC4": encode_IFC4
            },
            defaultVersion: "IFC4"
        });
    }
}
