// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that renders our Scene using the WebGLRenderer. Note that the
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

    // Create the first View - perspective projection, looking at the model from the side

    const view1 = viewer.createView({
      id: "demoView1",
      elementId: "demoCanvas1"
    });

    view1.camera.eye = [3, 5, 7];
    view1.camera.look = [0, 0, 0];
    view1.camera.up = [0, 1, 0];

    // Create the second View - orthographic projection, looking at the model from above

    const view2 = viewer.createView({
      id: "demoView2",
      elementId: "demoCanvas2"
    });

    view2.camera.eye = [3, 5, 7];
    view2.camera.look = [0, 0, 0];
    view2.camera.up = [0, 1, 0];

    // Create the third View, with default perspective projection

    const view3 = viewer.createView({
      id: "demoView3",
      elementId: "demoCanvas3"
    });

    view3.camera.eye = [3, 5, 7];
    view3.camera.look = [0, 0, 0];
    view3.camera.up = [0, 1, 0];

    // Attach a CameraControl to each View, to control
    // its Camera with mouse and touch input

    const cameraControl1 = new xeokit.cameracontrol.CameraControl(view1, {});
    const cameraControl2 = new xeokit.cameracontrol.CameraControl(view2, {});
    const cameraControl3 = new xeokit.cameracontrol.CameraControl(view3, {});

    // Create a SceneModel to hold model geometry and materials.
    // We'l create it from a single argument of type SceneModelParams.

    const sceneModel = scene.createModel({
      id: "demoModel",
      geometries: [
        {
          id: "boxGeometry",
          primitive: 20002,
          positions: [
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
          color: [1, 1, 1, 1],
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

    // The View will now contain a ViewObject for each SceneObject in the SceneModel.
    // The box SceneModel only contains a single SceneObject. Each View will therefore each contain a
    // single ViewObject through which we can programmatically update the appearance of the box in that
    // View. Let's colorize the box differently in each View.

    viewer.views["demoView1"].objects["boxObject"].colorize = [0.3, 1, 1];
    viewer.views["demoView2"].objects["boxObject"].colorize = [0.3, 1.0, 0.3];
    viewer.views["demoView3"].objects["boxObject"].colorize = [1, 0.3, 0.3];

    // Slowly orbit each View's Camera

    viewer.onTick.subscribe(() => {
      view1.camera.orbitYaw(-0.5);
      view2.camera.orbitYaw(0.5);
      view3.camera.orbitYaw(-1.3);
    });

    // Periodically re-colorize the box in each View

    let toggle = false;
    setInterval(() => {
      viewer.views["demoView1"].objects["boxObject"].colorize = (toggle = !toggle) ? [0.3, 1, 1] : [1, 0.3, 0.3];
    }, 1000);

    demoHelper.finished();
  });
