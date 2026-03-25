// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {scene, data} = demoHelper;

// Arrange the View's Camera

  const view = demoHelper.createView({
    camera: {
      eye: [-11.88,39.43, 12.95],
      look: [2.34,20.84,1.71],
      up: [0.26,-0.34,0.90],
      perspectiveProjection: {
        far: 10000000
      }
    },
    pointsMaterial: {
      pointSize: 2,
      roundPoints: true,
      perspectivePoints: true,
      minPerspectivePointSize: 1,
      maxPerspectivePointSize: 5,
      filterIntensity: false,
      minIntensity: 0,
      maxIntensity: 100
    }
  });

// Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  if (sceneModelResult.ok === false) {
    console.error(`Error creating SceneModel: ${sceneModelResult.error}`);
  }

  const sceneModel = sceneModelResult.value;

  // Create a DataModel to hold semantic data for our model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (dataModelResult.ok === false) {
    console.error(`Error creating DataModel: ${dataModelResult.error}`);
  }

  const dataModel = dataModelResult.value;

  // Use LASLoader to load a LAZ model into our SceneModel and DataModel

  const lasLoader = new xeokit.formats.las.LASLoader();

  fetch("../../models/Nalls-Pumpkin-Hill/laz/model.laz").then(response => {

    response
      .arrayBuffer()
      .then(fileData => {

        lasLoader.load({
          fileData,
          sceneModel,
          dataModel
        }).then(() => {

          // The Scene and SceneModel will now contain a SceneObject to represent the LAS/LAZ point cloud,
          // and the Data and DataModel will contain a corresponding DataObject.

          demoHelper.finished();

        }).catch(message => {
          console.error(`[LASLoader.load] Error loading LAS: ${message}`);
        });
      });
  });
});


