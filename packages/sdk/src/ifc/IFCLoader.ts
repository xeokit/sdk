import {ModelLoader, ModelParseParams} from "../io";
import {parse as parse_IFC4} from "./versions/IFC4/parse";

import {IfcAPI as IfcAPI_node} from "node_modules/web-ifc/web-ifc-api-node.js";
import {IfcAPI as IfcAPI_browser} from "node_modules/web-ifc/web-ifc-api.js";

/**
 * Loads an IFC file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link ifc | @xeokit/sdk/ifc}.
 */
export class IFCLoader extends ModelLoader {

    #ifcAPI: any;

    /**
     * Constructs an IFCLoader.
     */
    constructor() {

        const parse = (params: ModelParseParams, options: any): Promise<any> => {
            if (!this.#ifcAPI) {
                return new Promise<void>((resolve, reject) => {
                    let api;
                    let wasmPath = "";
                    switch (detectEnvironment()) {
                        case "browser":
                            api = IfcAPI_browser;
                            wasmPath = "https://cdn.jsdelivr.net/npm/web-ifc@0.0.51/"; // FIXME: this is hard-wired to 0.0.51
                            break;
                        case "node":
                            api = IfcAPI_node;
                            wasmPath = "../../node_modules/web-ifc/"; // Note that we can't (easily) fetch WASM over HTTP from node
                            break;
                        default:
                            reject("[IFCLoader] Failed to determine environment");
                            return;
                    }
                    this.#ifcAPI = new api();
                    this.#ifcAPI.SetWasmPath(wasmPath);
                    this.#ifcAPI.Init()
                        .then(() => {
                            parse_IFC4(this.#ifcAPI, params, options)
                                .then(() => {
                                    resolve()
                                })
                                .catch(reason => {
                                    reject("[IFCLoader] Failed to parse IFC - " + reason);
                                });
                        })
                        .catch(reason => {
                            reject("[IFCLoader] Failed to initialize WebIFC - " + reason);
                        });
                });
            } else {
                return parse_IFC4(this.#ifcAPI, params, options);
            }
        };

        super({
            fileDataType: "json",
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
