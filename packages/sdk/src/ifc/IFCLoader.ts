import {Loader, ParseParams} from "../io";
import {parse as parse_IFC4} from "./versions/IFC4/parse";

/**
 * Loads an IFC file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * See {@link "ifc" | @xeokit/ifc} for usage.
 */
export class IFCLoader extends Loader {

    #ifcAPI: any;

    /**
     * Constructs an IFCLoader.
     */
    constructor() {

        const parse = (args: ParseParams): Promise<any> => {
            if (!this.#ifcAPI) {
                return new Promise<void>((resolve, reject) => {
                    let importPath;
                    switch (detectEnvironment()) {
                        case "browser":
                            importPath = "web-ifc";
                            break;
                        case "node":
                            importPath = "web-ifc/web-ifc-api-node.js";
                            break;
                        default:
                            reject("[IFCLoader] Failed to determine environment");
                            return;
                    }
                    import(importPath)
                        .then(module => {
                            const WebIFC = module.default;
                            this.#ifcAPI = new WebIFC.IfcAPI();
                        //    this.#ifcAPI.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.51/");
                            this.#ifcAPI.Init()
                                .then(() => {
                                    parse_IFC4(this.#ifcAPI, args)
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
                        })
                        .catch(reason => {
                            reject("[IFCLoader] Failed to import WebIFC module - " + reason);
                        });
                });
            } else {
                return parse_IFC4(this.#ifcAPI, args);
            }
        };

        super({
            fileDataType: "json",
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
