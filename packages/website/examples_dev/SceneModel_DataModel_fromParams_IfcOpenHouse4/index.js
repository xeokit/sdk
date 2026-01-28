import {log} from "../../js/logger.js";

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold semantic data

const data = new xeokit.data.Data();

// Create a WebGLRenderer to use the browser's WebGL graphics API for rendering

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that will use the WebGLRenderer to draw the Scene

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

// Give the Viewer a single View to draw the Scene in our HTML canvas element

const view = viewer.createView({
  id: "demoView",
  elementId: "demoCanvas"
});

// Position the View's Camera

view.camera.eye = [-3.933, 2.855, 27.018];
view.camera.look = [4.400, 3.724, 8.899];
view.camera.up = [-0.018, 0.999, 0.039];

view.camera.zoom(5);
view.camera.orbitPitch(20);

// Add a CameraControl to interactively control the View's Camera with keyboard,
// mouse and touch input

new xeokit.cameracontrol.CameraControl(view, {});

// Create a SceneModel to hold our model's geometry and materials

const sceneModel = scene.createModel({
  id: "demoModel"
});

// Ignore the DemHelper

const demoHelper = new DemoHelper({
  viewer,
  data
});

demoHelper.init()
  .then(() => {

    // Create a DataModel to hold semantic data for our model

    const dataModel = data.createModel({
      id: "demoModel"
    });

    if (sceneModel instanceof xeokit.core.SDKError) {
      log(`Error creating SceneModel: ${sceneModel.message}`);

    } else {

      // Load JSON parameters into our SceneModel. The parameters follow the schema defined by SceneModelParams.

      fetch("../../models/Duplex/json/sceneModel.json").then(response => {

        response.json().then(sceneModelParams => {

          // Load JSON parameters into our DataModel. The parameters follow the schema defined by DataModelParams.

          fetch("../../models/Duplex/json/dataModel.json").then(response => {

            response.json().then(dataModelParams => {

              dataModel.fromParams(dataModelParams);
              sceneModel.fromParams(sceneModelParams);

              //  The View will now contain a ViewObject for each SceneObject in the SceneModel.

              demoHelper.finished();
            });
          });
        });
      });
    }

  });
