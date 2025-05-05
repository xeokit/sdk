import '@loaders.gl/polyfills';/**/
import {ModelConverter} from "../modelconverter";
import {GLTFLoader} from "../gltf";
import {DotBIMLoader, DotBIMExporter} from "../dotbim";
import {DataModelParamsLoader, DataModelParamsExporter} from "../data";
import {SceneModelParamsLoader, SceneModelParamsExporter} from "../scene";
import {CityJSONLoader} from "../cityjson";
import {XKTLoader} from "../xkt";
import {XGFLoader, XGFExporter} from "../xgf";
import {LASLoader} from "../las";
import {IFCExporter, IFCLoader} from "../ifc";

import {createModelConverterStatsReport} from "../modelconverter/reporters/stats/createModelConverterStatsReport";
import {createModelConverterManifestReport} from "../modelconverter/reporters/manifest/createModelConverterManifestReport";

/**
 * Available Reporters
 */
export const reporters = {
    "stats-report": createModelConverterStatsReport,
    "manifest-report": createModelConverterManifestReport
};

/**
 * A ModelConverter configured to support various
 * conversion pipelines. Add more pipelines as neccessary.
 */
export const modelConverter = new ModelConverter({

    loaders: {
        "ifc": new IFCLoader(),
        "dotbim": new DotBIMLoader(),
        "glb": new GLTFLoader(),
        "cityjson": new CityJSONLoader(),
        "xkt": new XKTLoader(),
        "xgf": new XGFLoader(),
        "las": new LASLoader(),
        "datamodel": new DataModelParamsLoader(),
        "scenemodel": new SceneModelParamsLoader()
    },

    exporters: {
        "ifc": new IFCExporter(),
        "xgf": new XGFExporter(),
        "dotbim": new DotBIMExporter(),
        "datamodel": new DataModelParamsExporter(),
        "scenemodel": new SceneModelParamsExporter()
    },

    pipelines: {

        "json": {
            inputs: {
                "scenemodel": {
                    loader: "scenemodel"
                },
                "datamodel": {
                    loader: "datamodel"
                }
            }
        },

        "gltf": {
            inputs: {
                "gltf": {
                    loader: "glb"
                }
            }
        },

        "gltf2xgf": {
            inputs: {
                "gltf": {
                    loader: "glb"
                }
            },
            outputs: {
                "xgf": {
                    exporter: "xgf"
                },
                "datamodel": {
                    exporter: "datamodel"
                }
            }
        },

        "gltf2dotbim": {
            inputs: {
                "gltf": {
                    loader: "gltf"
                },
                "datamodel": {
                    loader: "datamodel"
                }
            },
            outputs: {
                "dotbim": {
                    exporter: "dotbim"
                }
            }
        },

        "cityjson": {
            inputs: {
                "cityjson": {
                    loader: "cityjson"
                }
            }
        },

        "cityjson2xgf": {
            inputs: {
                "cityjson": {
                    loader: "cityjson"
                }
            },
            outputs: {
                "xgf": {
                    exporter: "xgf"
                },
                "datamodel": {
                    exporter: "datamodel"
                }

            }
        },

        "cityjson2json": {
            inputs: {
                "cityjson": {
                    loader: "cityjson"
                }
            },
            outputs: {
                "scenemodel": {
                    exporter: "scenemodel"
                },
                "datamodel": {
                    exporter: "datamodel"
                }

            }
        },

        "ifc": {
            inputs: {
                "ifc": {
                    loader: "ifc"
                }
            }
        },

        "ifc2json": {
            inputs: {
                "ifc": {
                    loader: "ifc"
                }
            },
            outputs: {
                "datamodel": {
                    exporter: "datamodel"
                },
                "scenemodel": {
                    exporter: "scenemodel"
                }
            }
        },

        "ifc2xgf": {
            inputs: {
                "ifc": {
                    loader: "ifc"
                }
            },
            outputs: {
                "xgf": {
                    exporter: "xgf"
                },
                "datamodel": {
                    exporter: "datamodel"
                }
            }
        },

        "ifc2dotbim": {
            inputs: {
                "ifc": {
                    loader: "ifc"
                }
            },
            outputs: {
                "dotbim": {
                    exporter: "dotbim"
                }
            }
        },

        "dotbim": {
            inputs: {
                "dotbim": {
                    loader: "dotbim"
                }
            }
        },

        "dotbim2json": {
            inputs: {
                "dotbim": {
                    loader: "dotbim"
                }
            },
            outputs: {
                "datamodel": {
                    exporter: "datamodel"
                },
                "scenemodel": {
                    exporter: "scenemodel"
                }
            }
        },

        "dotbim2xgf": {
            inputs: {
                "dotbim": {
                    loader: "dotbim"
                }
            },
            outputs: {
                "xgf": {
                    exporter: "xgf"
                },
                "datamodel": {
                    exporter: "datamodel"
                }
            }
        },

        "dotbim2ifc": {
            inputs: {
                "dotbim": {
                    loader: "dotbim"
                }
            },
            outputs: {
                "ifc": {
                    exporter: "ifc"
                }
            }
        },

        "las": {
            inputs: {
                "las": {
                    loader: "las",
                    options: {
                        center: false,
                        transform: [
                            1, 0, 0, 0,
                            0, 1, 0, 0,
                            0, 0, 1, 0,
                            0, 0, 0, 1
                        ],
                        skip: 1,
                        fp64: false,
                        colorDepth: "auto"
                    }
                }
            }
        },

        "las2xgf": {
            inputs: {
                "las": {
                    loader: "las",
                    options: {
                        center: false,
                        transform: [
                            1, 0, 0, 0,
                            0, 1, 0, 0,
                            0, 0, 1, 0,
                            0, 0, 0, 1
                        ],
                        skip: 1,
                        fp64: false,
                        colorDepth: "auto"
                    }
                }
            },
            outputs: {
                "xgf": {
                    exporter: "xgf"
                }
            }
        }
    }
});

