// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene} = demoHelper;

  // Position the View's Camera to look at the origin of the World coordinate system

  view.camera.eye = [2, 2, 10]; // Default is [0,0,10]
  view.camera.look = [0, 0, 0]; // Default
  view.camera.up = [0, 1, 0]; // Default

  // Create a SceneModel containing a SceneObject, a SceneMesh and a box-shaped SceneGeometry

  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.message);
  }

  const sceneModel = sceneModelResult.value;

  sceneModel.createGeometryCompressed({
    id: "boxGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,
    aabb: [-1, -1, -1, 1, 1, 1],
    positionsCompressed: [
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
  });

  sceneModel.createMesh({
    id: "boxMesh",
    geometryId: "boxGeometry",
    position: [0, 0, 0], // Default
    scale: [1, 1, 1], // Default
    rotation: [0, 0, 0], // Default
    color: [1.0, 0.0, 0.0] // Default is [1,1,1]
  });

  sceneModel.createObject({
    id: "boxObject",
    meshIds: ["boxMesh"]
  });

  // At this point, the View will contain a single ViewObject that has the same ID as the SceneModel. Through
  // the ViewObject, we can update the appearance of the box in that View.

  view.objects["boxObject"].highlighted = true;
  view.setObjectsHighlighted(view.highlightedObjectIds, false);

  // Ignore the DemoHelper

  demoHelper.finished();

  demoHelper.orbit();
});
