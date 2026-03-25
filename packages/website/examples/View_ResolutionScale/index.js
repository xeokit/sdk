// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {viewer, scene} = demoHelper;

  // Create a XGFLoader to load .XGF files

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Arrange the View's Camera within our +Z "up" coordinate system

  const view = demoHelper.createView({
    camera: {
      eye: [1841990.2778388674, 5173295.7011186555, 16.25441882894172],
      look: [1842022.2883483584, 5173301.846981712, 10.494716146446603],
      up: [0.1708873388776124, 0.032809545530215846, 0.9847441551659135]
    }
  });

  view.resolutionScale.resolutionScale = 0.6; // Start in low quality for faster loading

  // Tracks the pending restore-to-quality timeout while camera moves

  let restoreRenderModeTimeout = null;

  viewer.events.onCameraViewMatrixUpdated.subscribe(() => {

    // Switch immediately to fast render whenever camera moves

    view.renderMode = xeokit.constants.FastRender;

    // Reset the restore timer if we're still within the previous delay

    if (restoreRenderModeTimeout !== null) {
      clearTimeout(restoreRenderModeTimeout);
    }

    // Restore quality render 2 seconds after the last camera movement event

    restoreRenderModeTimeout = setTimeout(() => {
      view.renderMode = xeokit.constants.QualityRender;
      restoreRenderModeTimeout = null;
    }, 500);
  });

  // Create a SceneModel to hold our model's geometry and materials

  const sceneModelRes = scene.createModel({
    id: "demoModel",
    coordinateSystem: { // Model's local Y-up coordinate system
      basis: [
        1, 0, 0, // Right +X
        0, 1, 0, // Up +Y
        0, 0, -1 // Forward -Z
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  if (sceneModelRes.ok === false) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // Use the XGFLoader to load an IFC model from a .XGF file into our SceneModel and DataModel

  fetch("./model.xgf").then(response => {
    response.arrayBuffer().then(fileData => {
      xgfLoader.load({
        fileData,
        sceneModel
      }).then(() => {

        // Start in high quality once loading is complete

        view.renderMode = xeokit.constants.QualityRender;

        demoHelper.finished();

      }).catch(message => {
        throw new Error(`Error loading .XGF: ${message}`);
      });
    });
  });
});
