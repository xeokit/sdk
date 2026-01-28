// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

import {DemoHelper} from "../../js/DemoHelper.js";

const demoHelper = new DemoHelper({});

demoHelper.init().then(({
                          scene,
                          data,
                          viewer,
                          view,
                          renderer
                        }) => {

  // Create a CityJSONLoader to load CityJSON files

  const cityJSONLoader = new xeokit.formats.cityjson.CityJSONLoader();

  // Configure the View's World-space coordinate axis to make the +Z axis "up.
  // This is actually the default, but we show it here for clarity

  view.camera.worldAxis = [
    1, 0, 0, // Right +X
    0, 0, 1, // Up +Z
    0, -1, 0  // Forward -Y
  ];

  // Arrange the View's Camera within our +Z "up" coordinate system

  view.camera.eye = [11.50, 16.32, 15.12];
  view.camera.look = [9.01, 9.65, 11.22];
  view.camera.up = [-0.16, -0.45, 0.87];

  view.camera.zoom(-15)

  // Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    // coordinateSystem: { // Model's local CityJSON-standard coordinate system
    //   basis: [
    //     1, 0, 0, // Right +X
    //     0, 0, 1, // Up +Z
    //     0, -1, 0  // Forward -Y
    //   ],
    //   origin: [0, 0, 0],
    //   units: "meters"
    // }
  });

  if (!sceneModelResult.ok) {
    return;
  }

  const sceneModel = sceneModelResult.value;

  // Create a DataModel to hold semantic data for our model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    return;
  }

  const dataModel = dataModelResult.value;

  // Use CityJSONLoader to load an IFC model from a dotbim file into our SceneModel and DataModel

  fetch("../../models/LoD3_Railway/cityjson/model.json").then(response => {

    response
      .json()
      .then(fileData => {

        cityJSONLoader.load({
          fileData,
          sceneModel,
          dataModel
        }).then(() => {

          // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
          // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
          // will have a corresponding DataObject with the same ID, to attach semantic meaning.
          // The View will contain a ViewObject corresponding to each SceneObject, through which the
          // appearance of the object can be controlled in the View.

          demoHelper.finished();

        }).catch(message => {
          console.error(`Error loading CityJSON: ${message}`);
        });
      });
  });
});
