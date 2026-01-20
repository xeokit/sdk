import '@loaders.gl/polyfills';/**/
import {ModelConverter} from "../modelconverter";
import {GLTFLoader, GLTFExporter} from "../formats/gltf";
import {DotBIMLoader, DotBIMExporter} from "../formats/dotbim";
import {DataModelParamsLoader, DataModelParamsExporter} from "../formats/datamodel";
import {SceneModelParamsLoader, SceneModelParamsExporter} from "../formats/scenemodel";
import {CityJSONLoader} from "../formats/cityjson";
import {XKTLoader} from "../formats/xkt";
import {XGFLoader, XGFExporter} from "../formats/xgf";
import {LASLoader} from "../formats/las";
import {IFCExporter, IFCLoader} from "../formats/ifc";

import {createStatsReport} from "../modelconverter/reporters/stats/createStatsReport";
import {createManifestReport} from "../modelconverter/reporters/manifest/createManifestReport";

/**
 * Available Reporters
 */
export const reporters = {
  "stats-report": createStatsReport,
  "manifest-report": createManifestReport
};

export const CoordinateSystems = {

  // AEC convention - Revit, FreeCAD, OpenCascade, Blender etc

  ZUp_RightHanded_Meters: {
    basis: [1, 0, 0, 0, 1, 0, 0, 0, 1], // X+, Y+, Z+
    origin: [0, 0, 0],
    units: 'meters',
    scaleToMeters: 1
  },

  // OpenGL, glTF etc

  YUp_RightHanded_Meters: {
    basis: [1, 0, 0, 0, 0, -1, 0, 1, 0], // X+, Z-, Y+
    origin: [0, 0, 0],
    units: 'meters',
    scaleToMeters: 1
  }
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
    "glb": new GLTFExporter(),
    "datamodel": new DataModelParamsExporter(),
    "scenemodel": new SceneModelParamsExporter()
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

    "gltf2dotbim": {
      inputs: {
        "gltf": {
          loader: "gltf",
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
    }
  }
});

