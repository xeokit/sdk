import { ModelLoader } from "../ModelLoader";
import type { ModelParseParams } from "../ModelParseParams";
import { parse as parse_IFC4 } from "./versions/IFC4/parse";
import {getInitializedIFCAPI} from "./getInitializedIFCAPI";

/**
 * Loads an IFC file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link ifc | @xeokit/sdk/formats/ifc}.
 */
export class IFCLoader extends ModelLoader {

  constructor() {
    super({
      format: "IFC",
      fileDataType: "arraybuffer",
      parsers: {
        "IFC4": parse,
        "IFC2x3": parse,
      },
      getVersion: (fileData: any): string => {
        return "IFC4"; // HACK
      }
    });
  }
}

async function parse(params: ModelParseParams, options: any): Promise<any> {
  try {
    const ifcAPI = await getInitializedIFCAPI();
    return await parse_IFC4(ifcAPI, params, options);
  } catch (err) {
    return Promise.reject("[IFCLoader] " + err);
  }
}
