// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
  .init()
  .then(() => {

    const {view, scene} = demoHelper;

    // Position the View's Camera

    demoHelper.createView({
      camera: {
        eye: [3, 3, 3],
        look: [0, 0, 0],
        up: [0, 1, 0]
      }
    });

    const sceneModelResult = scene.createModel({
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
          color: [1, 1, 1],
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

    if (!sceneModelResult.ok) {
      throw new Error("Unable to create SceneModel: " + sceneModelResult.error);
    }

    // At this point, the View will contain a single ViewObject that has the same
    // ID as the SceneObject. Through the ViewObject, we can now update the
    // appearance of the box in that View.

    //  view.objects["triangleObject"].highlighted = true;

    demoHelper.finished();

  });
