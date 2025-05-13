import { IfcAPI } from "web-ifc";
import { ModelLoader } from "../io";
import type { ModelParseParams } from "../io";
import { parse as parse_IFC4 } from "./versions/IFC4/parse";

let ifcAPI: any = null;
/**
 * Loads an IFC file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link ifc | @xeokit/sdk/ifc}.
 */
export class IFCLoader extends ModelLoader {

  /**
   * Constructs an IFCLoader.
   */
  constructor() {
    super({
      format: "IFC",
      fileDataType: "text",
      parsers: {
        "IFC4": parse, // Internaly, web-ifc handles all versions
        "IFC2x3": parse,
      },
      getVersion: (fileData: any): string => {
        return "IFC4"; // HACK
      }
    });
  }
}

function parse(params: ModelParseParams, options: any): Promise<any> {
  return new Promise<void>((resolve, reject) => {
    if (!ifcAPI) {
      let wasmPath = "";
      switch (detectEnvironment()) {
        case "browser":
          wasmPath = "https://cdn.jsdelivr.net/npm/web-ifc@0.0.50/"; // FIXME: this is hard-wired to 0.0.50
          break;
        case "node":
          wasmPath = "../../node_modules/web-ifc/"; // Note that we can't (easily) fetch WASM over HTTP from node
          break;
        default:
          reject("[IFCLoader] Failed to determine environment");
          return;
      }
      ifcAPI = new IfcAPI();
      ifcAPI.SetWasmPath(wasmPath);
      ifcAPI.Init()
        .then(() => {
          parse_IFC4(ifcAPI, params, options)
            .then(resolve)
            .catch(reason => {
              reject("[IFCLoader] Failed to parse IFC - " + reason);
            });
        })
        .catch(reason => {
          reject("[IFCLoader] Failed to initialize WebIFC - " + reason);
        });
    } else {
      parse_IFC4(ifcAPI, params, options)
        .then(resolve)
        .catch(reason => {
          reject("[IFCLoader] Failed to parse IFC - " + reason);
        });
    }
  });
}

function detectEnvironment(): 'node' | 'browser' | 'unknown' {
  if (typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null) {
    return 'node';
  }
  if (typeof window !== 'undefined' &&
    typeof window.document !== 'undefined') {
    return 'browser';
  }
  return 'unknown';
}
