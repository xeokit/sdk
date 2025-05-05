import { encode as encode_IFC4 } from "./versions/IFC4/encode"
import { ModelExporter } from "../io";

/**
 * Exports a {@link scene!SceneModel | SceneModel} and {@link data!DataModel | DataModel} to an IFC file.
 *
 * For detailed usage, refer to {@link ifc | @xeokit/sdk/ifc}.
 */
export class IFCExporter extends ModelExporter {
  constructor() {
    super({
      format: "IFC",
      fileDataType: "text",
      encoders: {
        "IFC4": encode_IFC4
      },
      defaultVersion: "IFC4"
    });
  }
}
