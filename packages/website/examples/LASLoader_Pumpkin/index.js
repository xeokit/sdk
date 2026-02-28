// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data} = demoHelper;

// Arrange the View's Camera

  view.camera.eye = [-11.88,39.43, 12.95];
  view.camera.look = [2.34,20.84,1.71];
  view.camera.up = [0.26,-0.34,0.90];

// It's often a good idea to set a large distance from the eye to the far clipping plane of
// the Camera's PerspectiveProjection, to ensure that we fit all the points in the view volume
// instead of weirdly cutting them off in the distance.

  view.camera.perspectiveProjection.far = 10000000;

// Configure the View's PointsMaterial, which controls the appearance of our LAZ model

  view.pointsMaterial.pointSize = 2;
  view.pointsMaterial.roundPoints = false;
  view.pointsMaterial.perspectivePoints = true;
  view.pointsMaterial.minPerspectivePointSize = 2;
  view.pointsMaterial.maxPerspectivePointSize = 4;
  view.pointsMaterial.filterIntensity = false;
  view.pointsMaterial.minIntensity = 0;
  view.pointsMaterial.maxIntensity = 100;

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


       //   demoHelper.viewFit();

          demoHelper.orbit();

          // The Scene and SceneModel will now contain a SceneObject to represent the LAS/LAZ point cloud,
          // and the Data and DataModel will contain a corresponding DataObject.

          demoHelper.finished();

        }).catch(message => {
          console.error(`[LASLoader.load] Error loading LAS: ${message}`);
        });
      });
  });
});


