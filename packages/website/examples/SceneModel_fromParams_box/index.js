// Import the SDK from a bundle built for these examples

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

    // Create a SceneModel to hold geometry and materials. We'll
    // create the SceneModel in one shot from a SceneModelParams. In this example,
    // we create our SceneGeometry from uncompressed, double-precision floating
    // point values.

    const sceneModel = scene.createModel({
      id: "demoModel",
      geometries: [
        {
          id: "boxGeometry",
          primitive: 20002, // TrianglesPrimitive (defined in @xeokit/constants)
          positions: [ // 64-bit floats
            1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
            1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0,
            1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0,
            -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
            1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0
          ],
          indices: [
            0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
            8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
          ]
        }
      ],
      meshes: [
        {
          id: "boxMesh",
          geometryId: "boxGeometry",
          color: [1, 0, 0],
          opacity: 1
        }
      ],
      objects: [
        {
          id: "boxObject",
          meshIds: ["boxMesh"]
        }
      ]
    });

    // At this point, the View will contain a single ViewObject that has the same
    // ID as the SceneObject. Through the ViewObject, we can now update the
    // appearance of the box in that View.

    view.objects["boxObject"].highlighted = true;
    view.setObjectsHighlighted(view.highlightedObjectIds, false);

    demoHelper.finished();
  });
