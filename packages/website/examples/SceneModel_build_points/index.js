// Import the modules we need

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that views our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
  viewer
});

demoHelper
  .init()
  .then(() => {

    // Create a single View that renders to a canvas in the page

    const view = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    view.camera.eye = [0, -5, 20];
    view.camera.look = [0, -5, 0];
    view.camera.up = [0, 1, 0];

    // Add a CameraControl to interactively control the Camera with keyboard,
    // mouse and touch input

    new xeokit.cameracontrol.CameraControl(view);

    // Within the Scene, create a SceneModel.

    const sceneModel = scene.createModel({
      id: "demoModel"
    });

    if (sceneModel instanceof xeokit.core.SDKError) {
      console.error(`Error creating SceneModel: ${sceneModel.message}`);
    } else {

      // Within the SceneModel, create a SceneObject with a SceneMesh that
      // instances a SceneGeometry that defines a set of 3D points. The SceneMesh
      // has a 4x4 matrix, which we compose using buildMat4, to specify the modeling
      // transformation that it applies to the SceneGeometry vertex positions to
      // position them within the Viewer's World coordinate system.

      sceneModel.createGeometry({
        id: "demoBoxGeometry",
        primitive: xeokit.constants.PointsPrimitive,
        positions: [
          -1, -1, -1,
          -1, -1, 1,
          -1, 1, -1,
          -1, 1, 1,
          1, -1, -1,
          1, -1, 1,
          1, 1, -1,
          1, 1, 1
        ]
      });

      sceneModel.createMesh({
        id: "pointsMesh",
        geometryId: "pointsGeometry",
        _matrix: xeokit.scene.buildMat4({
          position: [-4, -6, -4],
          scale: [1, 1, 1],
          rotation: [0, 0, 0],
          color: [1, 1, 1]
        })
      });

      sceneModel.createObject({
        id: "pointsObject",
        meshIds: ["pointsMesh"]
      });

      // At this stage, the View will contain a single ViewObject that has the same ID as the SceneObject. Through
      // the ViewObject, we can now update the appearance of our 3D points in that View.

      //   view.objects["pointsObject"].highlighted = true;

      demoHelper.finished();
    }
  });
