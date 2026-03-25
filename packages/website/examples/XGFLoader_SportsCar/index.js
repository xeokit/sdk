// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {scene, data} = demoHelper;

  const view = demoHelper.createView({
    id: "demoView",
    camera: {
      eye: [3.27, 3.91, 2.39],
      look: [0, 0, 0],
      up: [-0.18, -0.28, 0.93]
    }
  });

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Create a SceneModel to hold our model's geometry and materials

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

  // Create a DataModel to hold semantic data for our model

  const dataModelRes = data.createModel({
    id: "demoModel"
  });

  if (dataModelRes.ok === false) {
    console.error(`Error creating DataModel: ${dataModelRes.error}`);
    return;
  }

  fetch("../../models/SportsCar/xgf/model.xgf").then(response => {

    response.arrayBuffer().then(fileData => {

      // Parse the XGF file and populate the SceneModel
      xgfLoader.load({
        fileData,
        sceneModel
      }).then(() => {

        const exploder = new xeokit.demo.SceneModelExploder({
          scene,
          sceneModel,
          aabb3Index: demoHelper.aabb3Index
        });

        exploder.rebuild();

        demoHelper.finished();

      }).catch(message => {
        console.error(`Error loading .XGF: ${message}`);
      });
    });
  });

});
