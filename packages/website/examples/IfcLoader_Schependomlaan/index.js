// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data} = demoHelper;

  // Create an IFCLoader to load IFC files

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Arrange the View's Camera

  // view.camera.eye = [14.915582703146043, 14.396781491179095, 5.431098754133695];
  // view.camera.look = [6.599999999999998, 8.34099990051474, -4.159999575600315];
  // view.camera.up = [-0.2820584034861215, 0.9025563895259413, -0.3253229483893775];

  // Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0,0,0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  // Create a DataModel to hold semantic data for our model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Load our IFC data into the SceneModel and DataModel

  fetch(`../../models/Schependomlaan/ifc/model.ifc`)
    .then(response => {
      response
        .arrayBuffer()
        .then(fileData => {

          ifcLoader.load({
            fileData,
            sceneModel,
            dataModel

          }).then(() => { // IFC file loaded

            demoHelper.viewFit();

            demoHelper.orbit();

            demoHelper.finished();

          }).catch(e => {
            console.error(e);
          });
        });
    });
});

