// Import the xeokit SDK bundle used by this example.
// Includes the rendering engine, format loaders, and demo helpers.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

function getCoordinateSystem(coordsys) {
  const systems = {
    // --- Base coordinate systems ---

    "yup-rh": {
      basis: [1, 0, 0,  0, 1, 0,  0, 0, -1],
      origin: [0, 0, 0],
      units: "meters"
    },
    "yup-lh": {
      basis: [1, 0, 0,  0, 1, 0,  0, 0, 1],
      origin: [0, 0, 0],
      units: "meters"
    },
    "zup-rh": {
      basis: [1, 0, 0,  0, 0, 1,  0, 1, 0],
      origin: [0, 0, 0],
      units: "meters"
    },
    "zup-lh": {
      basis: [1, 0, 0,  0, 0, 1,  0, -1, 0],
      origin: [0, 0, 0],
      units: "meters"
    },
    "xup-rh": {
      basis: [0, 1, 0,  1, 0, 0,  0, 0, 1],
      origin: [0, 0, 0],
      units: "meters"
    },
    "xup-lh": {
      basis: [0, 1, 0,  1, 0, 0,  0, 0, -1],
      origin: [0, 0, 0],
      units: "meters"
    }
  };

  // --- Aliases for common tools / formats ---
  const aliases = {
    // glTF / Web
    "gltf": "yup-rh",
    "glb": "yup-rh",
    "web": "yup-rh",

    // Blender
    "blender": "zup-rh",

    // Unity
    "unity": "yup-lh",

    // Unreal Engine
    "unreal": "zup-lh",

    // Autodesk tools
    "3dsmax": "zup-rh",
    "max": "zup-rh",
    "maya": "yup-rh",

    // BIM / CAD
    "revit": "zup-rh",
    "ifc": "zup-rh",
    "cad": "zup-rh",

    // Generic fallbacks
    "y-up": "yup-rh",
    "z-up": "zup-rh",
    "x-up": "xup-rh"
  };

  const key = coordsys.toLowerCase();

  const resolved = systems[key]
    ? key
    : aliases[key]
      ? aliases[key]
      : "yup-rh";

  return systems[resolved];
}

async function main() {
  const demoHelper = new xeokit.demo.DemoHelper({

  });

  await demoHelper.init({
    logging: false
  });

  const { data, scene } = demoHelper;

 const view = demoHelper.createView({
    camera: {
      "eye": [-3.23,-3.49,2.58],
      "look": [-0.03,0.05,0.5],
      "up": [0.26,0.29,0.91]
    }
  });

  const params = new URLSearchParams(window.location.search);
  const modelId = params.get("modelId") || "Duplex";
  const formatParam = params.get("format") || "xgf";
  const coordsysParam = params.get("coordsys") || "yup-rh";

  const coordinateSystem = getCoordinateSystem(coordsysParam);

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem,
   // deferredBuild: true
  });

  if (sceneModelResult.ok === false) {
    throw new Error(`Error creating SceneModel: ${sceneModelResult.error}`);
  }

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (dataModelResult.ok === false) {
    throw new Error(`Error creating DataModel: ${dataModelResult.error}`);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  const formats = formatParam
    .split(",")
    .map((format) => format.trim())
    .filter(Boolean);

  for (const format of formats) {
    await demoHelper.loadModel({ modelId, format, sceneModel, dataModel }, {});
  }

  sceneModel.finalize();

  demoHelper.viewFit(view);

  demoHelper.finished();
}

main().catch((err) => {
  console.error("Error initializing demo:", err);
});
