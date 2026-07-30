// Import the xeokit SDK bundle used by these examples.
// It includes the demo helper, renderer, scene/data APIs, and format loaders,
// so this file can focus on the XGF loading flow.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({
  maxViews: 2
});

studio.init().then(() => {

  const {scene} = studio;

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Configure the first camera in a +Z-up coordinate system.
  // This gives a clear perspective framing and makes world orientation explicit,
  // which is helpful when adapting to different asset up-axis conventions.

  studio.viewManager.createView({
      camera: {
        // Keep perspective projection for the main view.
        // It preserves depth cues and keeps setup simple.
        eye: [3.27, 3.91, 2.39],
        look: [0, 0, 0],
        up: [-0.18, -0.28, 0.93]
      }
  });

  const view2 = studio.viewManager.createView({
    camera: {
      eye: [3.27, 3.91, 2.39],
      look: [0, 0, 0],
      up: [-0.18, -0.28, 0.93]
    }
  });

  // Create a SceneModel to hold renderable model content.
  // It stores geometry and materials, and its coordinate system settings define
  // basis, origin, and units for consistent model interpretation.

  const sceneModelRes = scene.createModel({
    id: "demoModel",

    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    },
    updateHint: "dynamic"
  });

  if (sceneModelRes.ok === false) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // Fetch the XGF file, then load it into the SceneModel.

  fetch("../../models/SportsCar/xgf/model.xgf")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch XGF: ${response.status} ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
    .then((fileData) => {
      return xgfLoader.load({
        fileData,
        sceneModel
      });
    })
    .then(async () => {

      // Add a simple post-load inspection workflow.
      // Rebuild exploder bounds and apply x-ray styling in the second view to
      // highlight selected objects after loading.

      const exploder = new xeokit.presentations.exploder.SceneModelExploder({
        scene,
        sceneModel,
        collisionIndex: studio.picking.collisionIndex
      });

      exploder.rebuild();

      // SceneModelExploder still creates its own legacy floating slider.
      // This example keeps the control with the rest of the metadata UI.
      exploder._sliderContainer?.remove();
      exploder._sliderContainer = null;
      exploder._sliderElement = null;

      view2.setObjectsXRayed(view2.objectIds, true);

      view2.setObjectsXRayed(view2.objectIds.slice(30,40), false);

      const info = await studio.openInfoPanelFromMeta();
      info.addSlider({
        label: "Explode",
        min: 0,
        max: 2,
        step: 0.05,
        value: exploder.factor,
        digits: 2,
        onChange: value => exploder.setFactor(value)
      });

      studio.finished();
    })
    .catch((message) => {
      console.error(`Error loading XGF: ${message}`);
    });
});
