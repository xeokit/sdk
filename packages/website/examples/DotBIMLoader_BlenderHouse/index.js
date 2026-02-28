// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data} = demoHelper;

  // Create a DotBIMLoader to load .BIM files

  const dotBIMLoader = new xeokit.formats.dotbim.DotBIMLoader();

  // Configure the View's World-space coordinate axis to make the +Z axis "up"

  view.camera.worldAxis = [
    1, 0, 0, // Right +X
    0, 0, 1, // Up +Z
    0, -1, 0  // Forward -Y
  ];

// Arrange the View's Camera within our +Z "up" coordinate system

  view.camera.eye = [11.276311451067942, 16.914467176601914, 7.399026975905038];
  view.camera.look = [0, 0, 0];
  view.camera.up = [-0.18971864040782152, -0.28457796061173224, 0.9396926209223285];

// Create a SceneModel to hold our model's geometry and materials

  const sceneModelRes = scene.createModel({
    id: "demoModel",

    // Specify that the model's coordinates are in a right-handed system with +Z "up", and that units are in
    // meters. This will ensure that the model is oriented correctly in the View, and that any real-world
    // sizes in the model are correct. We actually don't need to specify this here since these are the
    // default settings for the coordinate system, but we'll specify it here for demonstration purposes.
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 0, 1, // Up
        0, 1, 0  // Forward
      ],
      origin: [0,0,0],
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

  } else {

    const dataModel = dataModelRes.value;

    // Use the DotBIMLoader to load an IFC model from a .BIM file into our SceneModel and DataModel

    fetch("../../models/BlenderHouse/dotbim/model.bim")
      .then(response => {


        response
          .json()
          .then(fileData => {

            dotBIMLoader.load({
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

            }).catch(message => {
              console.error(`Error loading .BIM: ${message}`);
            });
          });
      });
  }
});
