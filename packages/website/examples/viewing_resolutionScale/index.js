// Import the xeokit SDK bundle used by these examples.
// It provides the helper, renderer, and loader APIs used in this sample.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {viewer, scene} = studio;

  // Create an XGFLoader.
  // This loader parses XGF data into scene content.

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Create a view and set the initial camera.
  // The camera is placed around the model's expected location.

  const view = studio.viewManager.createView({
    camera: {
      eye: [1841990.2778388674, 5173295.7011186555, 16.25441882894172],
      look: [1842022.2883483584, 5173301.846981712, 10.494716146446603],
      up: [0.1708873388776124, 0.032809545530215846, 0.9847441551659135]
    }
  });

  // Start with a lower resolution scale for responsive interaction and loading.
  // The view will return to full-quality rendering after camera movement settles.
  view.resolutionScale.resolutionScale = 0.6;

  // Track the pending timer used to restore quality rendering.
  // Each new camera movement resets this timer.

  let restoreRenderModeTimeout = null;

  viewer.events.onCameraViewMatrixUpdated.subscribe(() => {

    // Switch to fast render while the camera is moving.
    // This reduces frame cost during interaction.

    view.renderMode = xeokit.base.constants.NavigationRender;

    // Clear the previous restore timer if it is still active.
    // This prevents quality mode from turning on too early.

    if (restoreRenderModeTimeout !== null) {
      clearTimeout(restoreRenderModeTimeout);
    }

    // Restore quality mode shortly after the last camera update.
    // This brings back higher image quality when interaction ends.

    restoreRenderModeTimeout = setTimeout(() => {
      view.renderMode = xeokit.base.constants.DetailedRender;
      restoreRenderModeTimeout = null;
    }, 500);
  });

  // Create a SceneModel for renderable model content.
  // Coordinate system values define how model axes and units are interpreted.

  const sceneModelRes = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, -1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  if (sceneModelRes.ok === false) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // Fetch and load the XGF file into the SceneModel.
  // After loading, switch the view back to quality rendering.

  fetch("./model.xgf").then(response => {
    response.arrayBuffer().then(fileData => {
      xgfLoader.load({
        fileData,
        sceneModel
      }).then(() => {

        // Return to quality rendering once loading is complete.
        // Interaction handlers will still switch to fast mode while moving.

        view.renderMode = xeokit.base.constants.DetailedRender;

        studio.finished();

      }).catch(message => {
        throw new Error(`Error loading .XGF: ${message}`);
      });
    });
  });
});
