// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data} = demoHelper;

  // Create a XGFLoader to load .XGF files

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Configure the View's World-space coordinate axis to make the +Z axis "up"

  view.camera.worldAxis = [
    1, 0, 0, // Right +X
    0, 0, 1, // Up +Z
    0, -1, 0  // Forward -Y
  ];

// // Arrange the View's Camera within our +Z "up" coordinate system
//
   view.camera.eye = [  1841990.2778388674, 5173295.7011186555, 16.25441882894172];
   view.camera.look = [ 1842022.2883483584, 5173301.846981712, 10.494716146446603];
   view.camera.up = [  0.1708873388776124, 0.032809545530215846, 0.9847441551659135];

// Create a SceneModel to hold our model's geometry and materials

  const sceneModelRes = scene.createModel({
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

  } else {

    const dataModel = dataModelRes.value;

    // Use the XGFLoader to load an IFC model from a .XGF file into our SceneModel and DataModel

    fetch("../../models/ME-MAP/ifc2xgf/model.xgf").then(response => {

      response
        .arrayBuffer()
        .then(fileData => {

          xgfLoader.load({
            fileData,
            sceneModel,
            dataModel
          }).then(() => {

              // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
              // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
              // will have a corresponding DataObject with the same ID, to show semantic meaning.
              // The View will contain a ViewObject corresponding to each SceneObject, through which the
              // appearance of the object can be controlled in the View.

              demoHelper.finished();

            //  demoHelper.viewFit();

            }).catch(message => {
              console.error(`Error loading .XGF: ${message}`);
            });
          });
      });
  }
});
