// Import xeokit SDK via the JavaScript bundle that we've built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials for our model

const scene = new xeokit.scene.Scene();

// Create a Viewer that viewManager our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer"
});

const result = viewer.attachScene(scene);
if (!result.ok) {
  throw new Error("Unable to attach Scene to Viewer: " + result.error);
}

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Attach the WebGLRenderer to the Viewer

const attachResult = renderer.attachViewer(viewer);
if (!attachResult.ok) {
  throw new Error("Unable to attach WebGLRenderer to Viewer: " + attachResult.error);
}

// Log any errors to the console.

new xeokit.core.EventsLogger(scene.events, {prefix: `[Scene    ]`});
new xeokit.core.EventsLogger(viewer.events, {prefix: `[Viewer   ]`});
new xeokit.core.EventsLogger(renderer.events, {prefix: `[Renderer ]`});

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
  makeComponents: false // Don't use boilerplate demo xeokit components
});

demoHelper
  .init()
  .then(() => {

    // Add a View, which will draw an independent view of the Scene within the
    // given DOM element.

    const viewResult = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    if (!viewResult.ok) {
      throw new Error("Unable to create View: " + viewResult.error);
    }

    const view = viewResult.value;

    view.camera.eye = [0, 0, 10]; // Default
    view.camera.look = [0, 0, 0]; // Default
    view.camera.up = [0, 1, 0]; // Default

    // Add a CameraControl to interactively control the Camera with keyboard,
    // mouse and touch input

    new xeokit.cameracontrol.CameraControl(view);

    // Create a minimal SceneModel that contains a single triangle

    const sceneModelResult = scene.createModel({
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
          color: [1, 1, 1],
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

    if (!sceneModelResult.ok) {
      throw new Error("Unable to create SceneModel: " + sceneModelResult.error);
    }

    // Serialize the Viewer's state to a JSON object of type ViewerParams.

    console.log(JSON.stringify(viewer.toParams(), null, 2));

    demoHelper.finished();
  });
