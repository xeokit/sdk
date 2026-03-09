// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data} = demoHelper;

  // Arrange the View's Camera within our +Z "up" coordinate system

  // view.camera.eye = [1841982.9384371885, 10.031355126263318, -5173286.744630201];
  // view.camera.look = [1842009.4968455553, 9.685518291306686, -5173295.851503017];
  // view.camera.up = [0.011650847910481935, 0.9999241456889114, -0.003995073374452514];

  // Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: { // Model's local Y-up coordinate system
      basis: [
        1, 0, 0, // Right +X
        0, 1, 0, // Up +Y
        0, 0, -1  // Forward -Z
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error(`Error creating SceneModel: ${sceneModelResult.error}`);
  }

  // Create a DataModel to hold semantic data for our model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (dataModelResult.ok === false) {
    throw new Error(`Error creating SceneModel: ${dataModelResult.error}`);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Use GLTFLoader to load a glTF model into our SceneModel and DataModel

  const gltfLoader = new xeokit.formats.gltf.GLTFLoader();

  fetch("../../models/MAP/gltf/model.glb").then(response => {

    response
      .arrayBuffer()
      .then(fileData => {

        gltfLoader.load({
          fileData,
          sceneModel,
          dataModel
        }).then(() => {

          // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.

          demoHelper.viewFit();

          demoHelper.orbit();

          demoHelper.finished();

        }).catch(message => {
          console.error(`Error loading glTF: ${message}`);
        });
      });
  });
});


