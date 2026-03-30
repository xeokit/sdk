// Import the xeokit SDK bundle used by this example.
// This includes the rendering engine plus format loaders and demo helpers.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up a ready-to-use Scene, View, and Data system.
// This avoids manual setup of rendering, camera, and data layers.
const demoHelper = new xeokit.demo.DemoHelper({});

// Initialize everything, then build the example.
demoHelper.init().then(() => {

  // These are the core systems:
  // - scene: holds geometry and renderable objects
  // - view: controls camera and rendering
  // - data: holds semantic/model metadata (eg. IFC structure)
  const {scene, data} = demoHelper;

  // Create a loader for .XGF files.
  // XGF is a compact xeokit-specific format (often converted from IFC).
  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  const view = demoHelper.createView({
    camera: {
      eye: [1841990.2778388674, 5173295.7011186555, 16.25441882894172],
      look: [1842022.2883483584, 5173301.846981712, 10.494716146446603],
      up: [0.1708873388776124, 0.032809545530215846, 0.9847441551659135]
    }
  });

  // Create a SceneModel to store geometry and materials.
  // This represents the visual side of the model.
  const sceneModelRes = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      // This model uses a local Y-up coordinate system.
      basis: [
        1, 0, 0, // +X = right
        0, 1, 0, // +Y = up
        0, 0, -1 // -Z = forward
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  if (!sceneModelRes.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // Load a .XGF file (converted from IFC) using fetch.
  // The file is loaded as binary data (ArrayBuffer).
  fetch("../../models/MAP/ifc2xgf/model.xgf").then(response => {

    response.arrayBuffer().then(fileData => {

      // Parse the XGF file and populate the SceneModel
      xgfLoader.load({
        fileData,
        sceneModel
      }).then(() => {

        // After loading, the SceneModel contains SceneObjects (visual elements)
        //
        // The View automatically creates ViewObjects for rendering,
        // which you can use to control visibility, color, selection, etc.

        const exploder = new xeokit.demo.SceneModelExploder({
          scene,
          sceneModel,
          aabb3Index: demoHelper.aabb3Index
        });

        exploder.rebuild();

        demoHelper.viewFit(view);

        demoHelper.finished();

      }).catch(message => {
        console.error(`Error loading .XGF: ${message}`);
      });
    });
  });
});
