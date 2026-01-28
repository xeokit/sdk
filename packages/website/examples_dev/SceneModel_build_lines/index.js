// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";
// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Viewer that draws our Scene

const viewer = new xeokit.viewer.Viewer({
  scene
});

// Create a WebGLRenderer to render the Viewer.

const renderer = new xeokit.webglrenderer.WebGLRenderer({
  viewer
});

// Log any errors to the console.

const logError = (sdkResult) => {
  if (sdkResult.ok === false) {
    console.error(sdkResult.error);
  }
}

scene.events.onError.subscribe(logError);
viewer.events.onError.subscribe(logError);
renderer.events.onError.subscribe(logError);

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
  viewer
});

demoHelper
  .init()
  .then(() => {

    // Create a single View that renders to a canvas

    const viewResult = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    if (!viewResult.ok) {
      return;
    }

    const view = viewResult.value;

    // Position the View's Camera

    view.camera.eye = [0, -5, 20];
    view.camera.look = [0, -5, 0];
    view.camera.up = [0, 1, 0];

    // Add a CameraControl to interactively control the Camera with keyboard,
    // mouse and touch input

    new xeokit.cameracontrol.CameraControl(view);

    // Within the Scene, create a SceneModel to hold geometry and materials
    // for our model

    const sceneModelResult = scene.createModel({
      id: "demoModel"
    });

    if (!sceneModelResult.ok) {
      return;
    }

      // Create a SceneGeometry that defines the shape of the wireframe box

      sceneModel.createGeometry({
        id: "boxGeometry",
        primitive: xeokit.constants.LinesPrimitive,

        // Define the SceneGeometry vertices - eight for our box, each
        // one spanning three array elements for X,Y and Z

        positions: [
          -1, -1, -1,
          -1, -1, 1,
          -1, 1, -1,
          -1, 1, 1,
          1, -1, -1,
          1, -1, 1,
          1, 1, -1,
          1, 1, 1
        ],

        // Define the SceneGeometry indices - these organise the
        // positions coordinates
        // into geometric primitives in accordance
        // with the LinesPrimitive parameter,
        // in this case a pair of indices
        // for each line segment.

        indices: [
          0, 1,
          1, 3,
          3, 2,
          2, 0,
          4, 5,
          5, 7,
          7, 6,
          6, 4,
          0, 4,
          1, 5,
          2, 6,
          3, 7
        ]
      });

      // For each of the model's tabletop and legs,
      // create a SceneObject that has a single SceneMesh that instances
      // and colors the box-shaped wireframe SceneGeometry. Each SceneMesh
      // has a 4x4 matrix, which we compose using buildMat4, to specify the
      // modeling transformation that the SceneMesh applies to the SceneGeometry's
      // vertex positions to position them within the World coordinate system.

      sceneModel.createMesh({
        id: "redLegMesh",
        geometryId: "boxGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [-4, -6, -4],
          scale: [1, 3, 1],
          rotation: [0, 0, 0],
          color: [1, 0.3, 0.3]
        })
      });

      sceneModel.createObject({
        id: "redLeg",
        meshIds: ["redLegMesh"]
      });

      sceneModel.createMesh({
        id: "greenLegMesh",
        geometryId: "boxGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [4, -6, -4],
          scale: [1, 3, 1],
          rotation: [0, 0, 0],
          color: [0.3, 1.0, 0.3]
        })
      });

      sceneModel.createObject({
        id: "greenLeg",
        meshIds: ["greenLegMesh"]
      });

      sceneModel.createMesh({
        id: "blueLegMesh",
        geometryId: "boxGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [4, -6, 4],
          scale: [1, 3, 1],
          rotation: [0, 0, 0],
          color: [0.3, 0.3, 1.0]
        })
      });

      sceneModel.createObject({
        id: "blueLeg",
        meshIds: ["blueLegMesh"]
      });

      sceneModel.createMesh({
        id: "yellowLegMesh",
        geometryId: "boxGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [-4, -6, 4],
          scale: [1, 3, 1],
          rotation: [0, 0, 0],
          color: [1.0, 1.0, 0.0]
        })
      });

      sceneModel.createObject({
        id: "yellowLeg",
        meshIds: ["yellowLegMesh"]
      });

      sceneModel.createMesh({
        id: "purpleTableTopMesh",
        geometryId: "boxGeometry",
        matrix: xeokit.scene.buildMat4({
          position: [0, -3, 0],
          scale: [6, 0.5, 6],
          rotation: [0, 0, 0],
          color: [1.0, 0.3, 1.0]
        })
      });

      sceneModel.createObject({
        id: "purpleTableTop",
        meshIds: ["purpleTableTopMesh"]
      });

      // At this point, the View will contain a five ViewObjects that have the
      // same IDs as the SceneObjects in our SceneModel. Through these
      // ViewObjects, we can update the appearance of each of our model's
      // objects within that View.

      view.objects["yellowLeg"].highlighted = true;
      view.setObjectsHighlighted(view.highlightedObjectIds, false);

      // Ignore the DemoHelper!

      demoHelper.finished();

  });
