import '@loaders.gl/polyfills';/**/
import {ModelConverter} from "../modelConverter";
import {GLTFLoader, GLTFExporter} from "../../formats/gltf";
import {DotBIMLoader, DotBIMExporter} from "../../formats/dotbim";
import {DataModelImporter, DataModelExporter} from "../../formats/datamodel";
import {SceneModelImporter, SceneModelExporter} from "../../formats/scenemodel";
import {CityJSONLoader, CityJSONExporter} from "../../formats/cityjson";
import {XGFLoader, XGFExporter} from "../../formats/xgf";
import {XGFStreamExporter} from "../../formats/xgfstream";
import {LASLoader} from "../../formats/las";
import {IFCExporter, IFCLoader} from "../../formats/ifc";
import {FBXLoader, FBXExporter} from "../../formats/fbx";
import {OBJLoader, OBJExporter} from "../../formats/obj";
import {MTLLoader, MTLExporter} from "../../formats/mtl";
import {DXFExporter} from "../../formats/dxf";
import {SVGExporter} from "../../formats/svg";
import {USDZLoader, USDZExporter} from "../../formats/usdz";
import {E57Loader, E57Exporter} from "../../formats/e57";
import {ThreeDTilesLoader} from "../../formats/threedtiles";
import {ThreeDXMLLoader, ThreeDXMLExporter} from "../../formats/threedxml";
import {FDSLoader, FDSExporter} from "../../formats/fds";
import {GaussianSplatLoader, GaussianSplatExporter} from "../../formats/gaussiansplat";
import {XKTLoader, XKTExporter} from "../../formats/legacy/xkt";
import {MetaModelLoader, MetaModelExporter} from "../../formats/legacy/metamodel";

import {createStatsReport} from "../modelConverter/reporters/stats/createStatsReport";
import {createManifestReport} from "../modelConverter/reporters/manifest/createManifestReport";
import {createInspectionReport} from "../modelConverter/reporters/inspection/createInspectionReport";
import {createOptimizationReport} from "../modelConverter/reporters/optimization/createOptimizationReport";
import {createConversionReport} from "../modelConverter/reporters/conversion/createConversionReport";

// Extension-based format resolution for the CLI's generic `--in/--out` mode.
export {resolveLoaderId, resolveExporterId, FORMAT_BY_EXTENSION} from "./resolveFormat";

// Config-file-driven inspection/optimization rule loading.
export {
  applyRuleConfig, applyInspectionConfig, applyOptimizationConfig, serializeRuleConfig,
} from "./loadRuleConfig";

/**
 * Available Reporters
 */
export const reporters = {
  "stats-report": createStatsReport,
  "manifest-report": createManifestReport,
  "inspection-report": createInspectionReport,
  "optimization-report": createOptimizationReport,
  "conversion-report": createConversionReport
};

export const CoordinateSystems = {

  // AEC convention - Revit, FreeCAD, OpenCascade, Blender etc

  ZUp_RightHanded_Meters: {
    basis: [
      1, 0, 0, // Right
      0, 0, 1, // Up
      0, 1, 0 // Forward
    ],
    origin: [0, 0, 0],
    units: 'meters',
    scaleToMeters: 1
  },

  // OpenGL, glTF etc

  YUp_RightHanded_Meters: {
    basis: [
      1, 0, 0, // Right
      0, 1, 0, // Up
      0, 0, 1 // Forward
    ],
    origin: [0, 0, 0],
    units: 'meters',
    scaleToMeters: 1
  }
};

/**
 * A ModelConverter configured to support various
 * conversion pipelines. Add more pipelines as neccessary.
 *
 * Registers every loader/exporter that implements the `ModelLoader` /
 * `ModelExporter` contract the converter drives. The DWG, DXF, SVG and
 * PDF *importers* are intentionally NOT registered: they are standalone
 * loaders with a bespoke `load(input): Promise<SDKResult<XLoadResult>>` shape
 * rather than `ModelLoader.load(params, options)`, so the pipeline can't drive
 * them. (Their DXF/SVG *exporters* do conform and are registered, so the
 * converter can write those formats even though it can't read them.)
 */
export const modelConverter = new ModelConverter({

  loaders: {
    "ifc": new IFCLoader(),
    "dotbim": new DotBIMLoader(),
    "glb": new GLTFLoader(),
    "cityjson": new CityJSONLoader(),
    "xgf": new XGFLoader(),
    "las": new LASLoader(),
    "datamodel": new DataModelImporter(),
    "scenemodel": new SceneModelImporter(),
    "fbx": new FBXLoader(),
    "obj": new OBJLoader(),
    "mtl": new MTLLoader(),
    "usdz": new USDZLoader(),
    "e57": new E57Loader(),
    "threedtiles": new ThreeDTilesLoader(),
    "threedxml": new ThreeDXMLLoader(),
    "fds": new FDSLoader(),
    "gaussiansplat": new GaussianSplatLoader(),
    "xkt": new XKTLoader(),
    "metamodel": new MetaModelLoader()
  },

  exporters: {
    "ifc": new IFCExporter(),
    "xgf": new XGFExporter(),
    "xgfstream": new XGFStreamExporter(),
    "dotbim": new DotBIMExporter(),
    "glb": new GLTFExporter(),
    "datamodel": new DataModelExporter(),
    "scenemodel": new SceneModelExporter(),
    "cityjson": new CityJSONExporter(),
    "fbx": new FBXExporter(),
    "obj": new OBJExporter(),
    "mtl": new MTLExporter(),
    "dxf": new DXFExporter(),
    "svg": new SVGExporter(),
    "usdz": new USDZExporter(),
    "e57": new E57Exporter(),
    "threedxml": new ThreeDXMLExporter(),
    "fds": new FDSExporter(),
    "gaussiansplat": new GaussianSplatExporter(),
    "xkt": new XKTExporter(),
    "metamodel": new MetaModelExporter()
  },

  // coordinateSystems: {
  //   "ZUp_RightHanded_Meters": {
  //     basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  //     origin: [0, 0, 0],
  //     units: 'meters',
  //     scaleToMeters: 1
  //   },
  //   "YUp_RightHanded_Meters": {
  //     basis: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  //     origin: [0, 0, 0],
  //     units: 'meters',
  //     scaleToMeters: 1
  //   }
  // },

  pipelines: {

    "json": {
      inputs: {
        "scenemodel": {
          loader: "scenemodel",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        },
        "datamodel": {
          loader: "datamodel"
        }
      }
    },

    "gltf": {
      inputs: {
        "gltf": {
          loader: "glb",
          options: {
            coordinateSystem: CoordinateSystems.YUp_RightHanded_Meters
          }
        }
      }
    },

    "gltf2xgf": {
      inputs: {
        "gltf": {
          loader: "glb",
          options: {
            coordinateSystem: CoordinateSystems.YUp_RightHanded_Meters
          },
          sceneModel: "geometry"
        }
      },
      outputs: {
        "xgf": {
          exporter: "xgf",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          },
          sceneModel: "geometry"
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "gltf2xgfstream": {
      inputs: {
        "gltf": {
          loader: "glb",
          options: {
            coordinateSystem: CoordinateSystems.YUp_RightHanded_Meters,
            retainTextureBytes: true
          },
          sceneModel: "geometry"
        }
      },
      outputs: {
        "xgfstream": {
          exporter: "xgfstream",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters,
            partition: "grid",
            chunkSize: 500,
            chunkBudget: 500,
            minChunkBudget: 125,
            assetLibraryChunkSize: 16,
            sharedAssetMinLibraryUses: 2,
            runtimeIndex: "index.runtime.json"
          },
          sceneModel: "geometry"
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "gltf2gltf": {
      inputs: {
        "gltf": {
          loader: "glb",
          options: {
            coordinateSystem: CoordinateSystems.YUp_RightHanded_Meters
          },
          sceneModel: "geometry"
        }
      },
      outputs: {
        "gltf-out": {
          exporter: "glb",
          options: {
            coordinateSystem: CoordinateSystems.YUp_RightHanded_Meters
          },
          sceneModel: "geometry"
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "gltf2dotbim": {
      inputs: {
        "gltf": {
          loader: "glb",
          options: {
            coordinateSystem: CoordinateSystems.YUp_RightHanded_Meters
          }
        },
        "datamodel": {
          loader: "datamodel"
        }
      },
      outputs: {
        "dotbim": {
          exporter: "dotbim",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "cityjson": {
      inputs: {
        "cityjson": {
          loader: "cityjson",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "cityjson2xgf": {
      inputs: {
        "cityjson": {
          loader: "cityjson",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgf": {
          exporter: "xgf",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "cityjson2xgfstream": {
      inputs: {
        "cityjson": {
          loader: "cityjson",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgfstream": {
          exporter: "xgfstream",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters,
            partition: "grid",
            runtimeIndex: "index.runtime.json"
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "cityjson2json": {
      inputs: {
        "cityjson": {
          loader: "cityjson",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "scenemodel": {
          exporter: "scenemodel",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }

      }
    },

    "ifc": {
      inputs: {
        "ifc": {
          loader: "ifc",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "ifc2json": {
      inputs: {
        "ifc": {
          loader: "ifc",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "datamodel": {
          exporter: "datamodel"
        },
        "scenemodel": {
          exporter: "scenemodel",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "ifc2xgf": {
      inputs: {
        "ifc": {
          loader: "ifc",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgf": {
          exporter: "xgf",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "ifc2xgfstream": {
      inputs: {
        "ifc": {
          loader: "ifc",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgfstream": {
          exporter: "xgfstream",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters,
            partition: "grid",
            runtimeIndex: "index.runtime.json"
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "ifc2dotbim": {
      inputs: {
        "ifc": {
          loader: "ifc",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "dotbim": {
          exporter: "dotbim",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "dotbim2gltf": {
      inputs: {
        "dotbim": {
          loader: "dotbim",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "gltf": {
          exporter: "glb",
          options: {
            coordinateSystem: CoordinateSystems.YUp_RightHanded_Meters
          }
        }
      }
    },

    "dotbim": {
      inputs: {
        "dotbim": {
          loader: "dotbim",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "dotbim2json": {
      inputs: {
        "dotbim": {
          loader: "dotbim",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "datamodel": {
          exporter: "datamodel"
        },
        "scenemodel": {
          exporter: "scenemodel",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "dotbim2xgf": {
      inputs: {
        "dotbim": {
          loader: "dotbim",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgf": {
          exporter: "xgf",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "dotbim2xgfstream": {
      inputs: {
        "dotbim": {
          loader: "dotbim",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgfstream": {
          exporter: "xgfstream",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters,
            partition: "grid",
            runtimeIndex: "index.runtime.json"
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "dotbim2ifc": {
      inputs: {
        "dotbim": {
          loader: "dotbim",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "ifc": {
          exporter: "ifc",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "las": {
      inputs: {
        "las": {
          loader: "las",
          options: {
            center: false,
            skip: 1,
            fp64: false,
            colorDepth: "auto",
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
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
            skip: 1,
            fp64: false,
            colorDepth: "auto",
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgf": {
          exporter: "xgf",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "xkt": {
      inputs: {
        "xkt": {
          loader: "xkt",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "xkt2json": {
      inputs: {
        "xkt": {
          loader: "xkt",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "datamodel": {
          exporter: "datamodel"
        },
        "scenemodel": {
          exporter: "scenemodel",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    },

    "xkt2xgf": {
      inputs: {
        "xkt": {
          loader: "xkt",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgf": {
          exporter: "xgf",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "xkt2xgfstream": {
      inputs: {
        "xkt": {
          loader: "xkt",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      },
      outputs: {
        "xgfstream": {
          exporter: "xgfstream",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters,
            partition: "grid",
            runtimeIndex: "index.runtime.json"
          }
        },
        "datamodel": {
          exporter: "datamodel"
        }
      }
    },

    "xgf2xkt": {
      inputs: {
        "xgf": {
          loader: "xgf",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        },
        "datamodel": {
          loader: "datamodel"
        }
      },
      outputs: {
        "xkt": {
          exporter: "xkt",
          options: {
            coordinateSystem: CoordinateSystems.ZUp_RightHanded_Meters
          }
        }
      }
    }
  }
});
