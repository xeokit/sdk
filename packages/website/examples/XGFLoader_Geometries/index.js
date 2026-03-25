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

  demoHelper.createView({
    camera: {
      eye: [10, 10, 10],
      look: [0, 0, 0],
      up: [0, 1, 0]
    }
  });

  // Create a loader for .XGF files.
  // XGF is a compact xeokit-specific format (often converted from IFC).
  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Create a SceneModel to store geometry and materials.
  // This represents the visual side of the model.
  const sceneModelRes = scene.createModel({
    id: "demoModel",
    // "coordinateSystem": {
    //   basis: [
    //     1, 0, 0, // Right
    //     0, 0, 1, // Up
    //     0, 1, 0  // Forward
    //   ],
    //   origin: [0, 0, 0],
    //   units: "meters",
    //   scaleToMeters: 1
    // }
  });

  if (!sceneModelRes.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

    // Load a .XGF file (converted from IFC) using fetch.
    // The file is loaded as binary data (ArrayBuffer).
    fetch("../../models/Geometries/xgf/model.xgf").then(response => {

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

          demoHelper.finished();

          // Optionally fit the camera to the loaded model:
          // demoHelper.viewFit();

        }).catch(message => {
          console.error(`Error loading .XGF: ${message}`);
        });
      });
    });
});
