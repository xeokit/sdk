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

/**
 *
 * @param options
 */
export function getModelConverter(options: any): Promise<ModelConverter> {

    return new Promise<ModelConverter>((resolve, reject) => {

        const modelTransformer = new ModelConverter({

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

                // node xeoconvert.js --pipeline gltf2xgf --gltf model.glb --xgf model.xgf --datamodel dataModel.json

                "gltf2xgf": {
                    inputs: {
                        "gltf": {
                            loader: "glb",
                            options: {}
                        }
                    },
                    outputs: {
                        "xgf": {
                            exporter: "xgf",
                            version: "1.0",
                            options: {}
                        },
                        "datamodel": {
                            exporter: "datamodel",
                            version: "1.0",
                            options: {}
                        }
                    }
                },

                // node xeoconvert.js --pipeline gltf2dotbim --gltf model.glb --datamodel dataModel.json --dotbim model.bim

                "gltf2dotbim": {
                    inputs: {
                        "gltf": {
                            loader: "gltf",
                            sceneModel: "mySceneModel",
                            options: {}
                        },
                        "datamodel": {
                            loader: "datamodel",
                            dataModel: "myDataModel",
                            options: {}
                        }
                    },
                    outputs: {
                        "dotbim": {
                            exporter: "dotbim",
                            version: "1.0",
                            sceneModel: "mySceneModel", //
                            dataModel: "myDataModel",
                            options: {}
                        }
                    }
                },

                // node xeoconvert.js --pipeline cityjson2xgf --cityjson model.json --datamodel dataModel.json --xgf model.xgf

                "cityjson2xgf": {
                    inputs: {
                        "cityjson": {
                            loader: "cityjson",
                            options: {}
                        }
                    },
                    outputs: {
                        "xgf": {
                            exporter: "xgf",
                            version: "1.0",
                            options: {}
                        },
                        "datamodel": {
                            exporter: "datamodel",
                            version: "1.0",
                            options: {}
                        }

                    }
                },

                // node xeoconvert.js --pipeline ifc2xgf --ifc model.ifc --datamodel model.json --xgf model.xgf

                "ifc2xgf": {
                    inputs: {
                        "ifc": {
                            loader: "ifc",
                            options: {}
                        }
                    },
                    outputs: {
                        "xgf": {
                            exporter: "xgf",
                            version: "1.0",
                            options: {}
                        },
                        "datamodel": {
                            exporter: "datamodel",
                            version: "1.0",
                            options: {}
                        }

                    }
                },

                // node xeoconvert.js --pipeline ifc2dotbim --ifc model.ifc --dotbim model.bim

                "ifc2dotbim": {
                    inputs: {
                        "ifc": {
                            loader: "ifc",
                            options: {}
                        }
                    },
                    outputs: {
                        "dotbim": {
                            exporter: "dotbim",
                            version: "1.1",
                            options: {}
                        }
                    }
                },

                // node xeoconvert.js --pipeline dotbim2xgf --dotbim model.bim --xgf model.xgf

                "dotbim2xgf": {
                    inputs: {
                        "dotbim": {
                            loader: "dotbim",
                            options: {}
                        }
                    },
                    outputs: {
                        "xgf": {
                            exporter: "xgf",
                            version: "1.0",
                            options: {}
                        }
                    }
                },

                // node xeoconvert.js --pipeline dotbim2ifc --dotbim model.bim --ifc model.ifc

                "dotbim2ifc": {
                    inputs: {
                        "dotbim": {
                            loader: "dotbim",
                            options: {}
                        }
                    },
                    outputs: {
                        "ifc": {
                            exporter: "ifc",
                            version: "IFC4",
                            options: {}
                        }
                    }
                },

                // node xeoconvert.js --pipeline las2xgf --las model.las --xgf model.xgf

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
                            exporter: "xgf",
                            version: "1.0",
                            options: {}
                        }
                    }
                }
            }
        });

        resolve(modelTransformer);
    });
}
