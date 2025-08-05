// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold model geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold semantic information about the model

const data = new xeokit.data.Data();

// Create a WebGLRenderer to use the browser's WebGL API for rendering

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer which uses the WebGLRenderer to render the Scene

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
  viewer,
  data
});

demoHelper.init()
  .then(() => {

    // Create the first View. This View has a perspective projection, looking at the model from the side, and is initially
    // set to render in QualityRender mode.

    const view1 = viewer.createView({
      id: "demoView1",
      elementId: "demoCanvas1",
      renderMode: xeokit.constants.QualityRender
    });

    view1.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
    view1.camera.eye = [0, -10, -20];
    view1.camera.look = [0, -10, 0];
    view1.camera.up = [0, 1, 0];
    view1.edges.enabled = true;

    // Add a CameraControl to the first View, to control its Camera with keyboard, mouse and touchpad input.

    new xeokit.cameracontrol.CameraControl(view1, {});

    // Configure the first View's edge enhancement and ambient shadows effects
    // to apply in QualityRender mode

    view1.edges.renderModes = [xeokit.constants.QualityRender];
    view1.sao.renderModes = [xeokit.constants.QualityRender];

    // Create the second View. This View has an orthographc projection, looking at the model from the top, and is initially
    // set to render in FastRender mode.

    const view2 = viewer.createView({
      id: "demoView2",
      elementId: "demoCanvas2",
      renderMode: xeokit.constants.FastRender
    });

    view2.camera.projectionType = xeokit.constants.OrthoProjectionType;
    view2.camera.eye = [0, -5, 20];
    view2.camera.look = [0, -5, 0];
    view2.camera.up = [0, 1, 0];
    view2.camera.orthoProjection.scale = 20;
    view2.camera.orbitPitch(90);

    // Add a CameraControl to the second View.

    new xeokit.cameracontrol.CameraControl(view2, {});

    // Configure the second View's edge enhancement and ambient shadows effects
    // to apply only in QualityRender mode.

    view2.edges.renderModes = [xeokit.constants.QualityRender];
    view2.sao.renderModes = [xeokit.constants.QualityRender];

    // Create the second View. This View has a perspective projection, looking at the model from the front, and is initially
    // set to render in FastRender mode.

    const view3 = viewer.createView({
      id: "demoView3",
      elementId: "demoCanvas3",
      renderMode: xeokit.constants.FastRender
    });

    view3.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
    view3.camera.eye = [0, -5, 20];
    view3.camera.look = [0, -5, 0];
    view3.camera.up = [0, 1, 0];
    view3.camera.zoom(2);
    view3.camera.orbitYaw(-50);
    view3.camera.orbitPitch(20);

    // Add a CameraControl to the third View.

    new xeokit.cameracontrol.CameraControl(view3, {});

    // Configure the third View's edge enhancement and ambient shadows effects
    // to apply in QualityRender mode; they will not apply as long as the third
    // View remains in FastRender mode.

    view3.edges.renderModes = [xeokit.constants.QualityRender];
    view3.sao.renderModes = [xeokit.constants.QualityRender];

    // Create a SceneModel to hold our model's geometry and materials

    const sceneModel = scene.createModel({
      id: "demoModel"
    });

    // Load a model from JSON-encoded format, which has the schema defined by SceneModelParams

    fetch("../../models/Duplex/json/scenemodel.json").then(response => {
      response.json().then(fileData => {
        sceneModel.fromParams(fileData);

        // The View will now contain a ViewObject for each
        // SceneObject in the SceneModel.

        demoHelper.finished();
      });
    });
  });
