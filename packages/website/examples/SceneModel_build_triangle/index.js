// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials for our triangle

const scene = new xeokit.scene.Scene();

// Create a WebGLRenderer to use the browser's WebGL API to draw the Scene

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that views our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

const demoHelper = new DemoHelper({
  viewer
});

demoHelper.init()
  .then(() => {

    // Add a View, which will render an independent view of the Scene within the
    // given DOM element.

    const view = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    // Position the View's Camera

    view.camera.eye = [0, 0, 7]; // Default
    view.camera.look = [0, 0, 0]; // Default
    view.camera.up = [0, 1, 0]; // Default

    // Add a CameraControl to interactively control the Camera with keyboard,
    // mouse and touch input

    new xeokit.cameracontrol.CameraControl(view);

    // Within the Scene, create a SceneModel to hold geometry and materials for our model

    const sceneModel = scene.createModel({
      id: "demoModel"
    });

    // Create a SceneGeometry that defines that shape of our triangle

    sceneModel.createGeometry({
      id: "triangleGeometry",
      primitive: xeokit.constants.TrianglesPrimitive,
      positions: [
        0.0, 1.5, 0.0,
        -1.5, -1.5, 0.0,
        1.5, -1.5, 0.0,
      ],
      indices: [
        0, 1, 2
      ]
    });

    // Create a SceneMesh that defines both the shape and
    // the surface appearance of our triangle

    sceneModel.createMesh({
      id: "triangleMesh",
      geometryId: "triangleGeometry",
      matrix: [ // Default
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    });

    // Create a SceneObject that defines the triangle object itself

    sceneModel.createObject({
      id: "triangleObject",
      meshIds: ["triangleMesh"]
    });

    // At this point, the View will contain a single ViewObject that has the same
    // ID as the SceneObject. Through the ViewObject, we can now update the
    // appearance of the box in that View.

    view.objects["triangleObject"].highlighted = true;

    demoHelper.finished();
  });
