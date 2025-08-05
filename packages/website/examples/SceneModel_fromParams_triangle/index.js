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
  elementId: "info-container",
  viewer
});

demoHelper.init()
  .then(() => {

    // Give the Viewer a single View to render the Scene in our HTML canvas element

    const view = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    // Position the View's Camera

    view.camera.eye = [3, 3, 3];
    view.camera.look = [0, 0, 0];
    view.camera.up = [0, 1, 0];

    // Add a CameraControl to interactively control the Camera with keyboard,
    // mouse and touch input

    new xeokit.cameracontrol.CameraControl(view);

    const sceneModel = scene.createModel({
      id: "demoModel",
      geometries: [
        {
          id: "triangleGeometry",
          primitive: 20002, // TrianglesPrimitive (defined in @xeokit/constants)
          positions: [
            0.0, 1.5, 0.0,
            -1.5, -1.5, 0.0,
            1.5, -1.5, 0.0,
          ],
          indices: [
            0, 1, 2
          ]
        }
      ],
      meshes: [
        {
          id: "triangleMesh",
          geometryId: "triangleGeometry",
          color: [1, 1, 1, 1],
          opacity: 1
        }
      ],
      objects: [
        {
          id: "triangleObject",
          meshIds: ["triangleMesh"]
        }
      ]
    });

    // At this point, the View will contain a single ViewObject that has the same
    // ID as the SceneObject. Through the ViewObject, we can now update the
    // appearance of the box in that View.

    view.objects["triangleObject"].highlighted = true;

    demoHelper.finished();

  });
