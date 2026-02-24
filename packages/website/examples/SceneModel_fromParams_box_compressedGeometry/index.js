// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene} = demoHelper;

  // Position the View's Camera

  view.camera.eye = [3, 3, 3];
  view.camera.look = [0, 0, 0];
  view.camera.up = [0, 1, 0];

  // Create a SceneModel to hold geometry and materials. We'll
  // create the SceneModel from an argument of type SceneModelParams. In this example,
  // we create our SceneGeometry with vertex positions that are quantized
  // to 16-bit integer values within the range indicated by the axis-aligned
  // 3D boundary specified by parameter aabb.

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    geometriesCompressed: [
      {
        id: "boxGeometry",
        primitive: 20002, // TrianglesPrimitive (defined in @xeokit/constants)
        aabb: [-1, -1, -1, 1, 1, 1],
        positionsCompressed: [ // 16-bit unsigned integers
          65525, 65525, 65525, 0, 65525, 65525, 0, 0, 65525, 65525, 0,
          65525, 65525, 65525, 65525, 65525, 0, 65525, 65525, 0, 0,
          65525, 65525, 0, 65525, 65525, 65525, 65525, 65525, 0, 0,
          65525, 0, 0, 65525, 65525, 0, 65525, 65525, 0, 65525, 0,
          0, 0, 0, 0, 0, 65525, 0, 0, 0, 65525, 0, 0, 65525, 0, 65525,
          0, 0, 65525, 65525, 0, 0, 0, 0, 0, 0, 65525, 0, 65525, 65525, 0
        ],
        indices: [
          0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13,
          14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
        ],
        edgeIndices: [
          8, 12, 12, 19, 19, 18, 8, 18, 18, 20, 20, 23,
          8, 23, 23, 22, 12, 22, 22, 21, 19, 21, 20, 21
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

  // At this point, the View will contain a single ViewObject that has the same
  // ID as the SceneObject. Through the ViewObject, we can now update the
  // appearance of the box in that View.

  // view.objects["boxObject"].highlighted = true;
  // view.setObjectsHighlighted(view.highlightedObjectIds, false);

  demoHelper.finished();
});
