import { encode as encode_IFC4 } from "./versions/IFC4/encode";
import {type ModelEncodeParams, ModelExporter} from "../io";
import { getInitializedIFCAPI } from "./getInitializedIFCAPI";

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
        "IFC4": encode
      },
      defaultVersion: "IFC4"
    });
  }
}

async function encode(params: ModelEncodeParams, options: any): Promise<any> {
  try {
    const ifcAPI = await getInitializedIFCAPI();
    return await encode_IFC4(ifcAPI, params, options);
  } catch (err) {
    return Promise.reject("[IFCExporter] " + err);
  }
}
