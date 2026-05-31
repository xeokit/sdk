// Import the xeokit SDK bundle used by these examples.
// The bundle provides loader, scene, and helper APIs used below.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene, data} = studio;

  const view = studio.viewManager.createView({
    id: "demoView",
    camera: {
      eye: [3.27, 3.91, 2.39],
      look: [0, 0, 0],
      up: [-0.18, -0.28, 0.93]
    }
  });

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Create a SceneModel for renderable model content.
  // Coordinate settings define basis, origin, and units for the loaded data.

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
    }
  });

  if (sceneModelRes.ok === false) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // Create a DataModel for semantic model data.
  // This can be used for metadata-driven interactions.

  const dataModelRes = data.createModel({
    id: "demoModel"
  });

  if (dataModelRes.ok === false) {
    console.error(`Error creating DataModel: ${dataModelRes.error}`);
    return;
  }

  fetch("../../models/SportsCar/xgf/model.xgf").then(response => {

    response.arrayBuffer().then(fileData => {

      // Load the XGF file into the SceneModel.
      // When loading finishes, build helper visualization state.
      xgfLoader.load({
        fileData,
        sceneModel
      }).then(() => {

        const exploder = new xeokit.presentations.exploder.SceneModelExploder({
          scene,
          sceneModel,
          collisionIndex: studio.picking.collisionIndex
        });

        exploder.rebuild();

        studio.openInfoPanelFromMeta();
        studio.finished();

      }).catch(message => {
        console.error(`Error loading .XGF: ${message}`);
      });
    });
  });

});
