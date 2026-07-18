// Import the xeokit SDK bundle. This bundle provides the rendering
// engine together with format loaders and demo utilities used by
// this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared runtime
// context and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({});

// Initialize the runtime context before creating views or loading
// model content.
studio.init().then(() => {

  // Access the Scene and Data subsystems created by the Studio.
  // The Scene manages renderable content, while the Data subsystem
  // manages semantic model information when present.
  const { scene, data } = studio;

  // Create an XGFLoader to parse xeokit XGF model data into the
  // renderable scene model.
  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Create a View and position the camera to frame the model from
  // the desired starting viewpoint.
  const view = studio.viewManager.createView({
    camera: {
      eye: [1841990.2778388674, 5173295.7011186555, 16.25441882894172],
      look: [1842022.2883483584, 5173301.846981712, 10.494716146446603],
      up: [0.1708873388776124, 0.032809545530215846, 0.9847441551659135]
    }
  });

  view.effects.edges.renderModes = [
    xeokit.base.constants.DetailedRender,
    xeokit.base.constants.RealisticRender
  ];
  view.effects.edges.useMeshColor = true;
  view.effects.edges.edgeWidth = 2;

  // Create a SceneModel to hold renderable geometry and material state.
  // The coordinate system is defined explicitly so that axis orientation
  // and units are interpreted consistently.
  const sceneModelRes = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
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

  // Fetch the XGF file as binary data and load it into the SceneModel.
  // The loaded model was converted from IFC into xeokit's compact XGF
  // representation.
  fetch("../../models/MAP/xgf/model.xgf").then(response => {

    response.arrayBuffer().then(fileData => {

      xgfLoader.load({
        fileData,
        sceneModel
      }).then(async () => {

        // At this point, the SceneModel contains SceneObjects for the
        // loaded model, and the View contains corresponding ViewObjects
        // that control per-view appearance and interaction state.

        // Create a SceneModelExploder to compute exploded positions for
        // the loaded model, then rebuild its internal state.
        const exploder = new xeokit.presentations.exploder.SceneModelExploder({
          scene,
          sceneModel,
          collisionIndex: studio.picking.collisionIndex
        });

        exploder.rebuild();
        exploder.setFactor(0);

        // SceneModelExploder still creates its own legacy floating slider.
        // Keep the control with the rest of the example metadata UI.
        exploder._sliderContainer?.remove();
        exploder._sliderContainer = null;
        exploder._sliderElement = null;

        const info = await studio.openInfoPanelFromMeta();
        info.addSlider({
          label: "Explode",
          min: 0,
          max: 2,
          step: 0.05,
          value: 0,
          digits: 2,
          onChange: value => exploder.setFactor(value)
        });

        studio.finished();
        document.querySelectorAll(".xeokit-loading-overlay").forEach(el => {
          el.style.display = "none";
        });

      }).catch(message => {
        console.error(`Error loading .XGF: ${message}`);
      });
    });
  });
});
