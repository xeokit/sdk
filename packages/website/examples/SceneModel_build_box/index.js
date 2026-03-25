// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {scene} = demoHelper;

  // Position the View's Camera to look at the origin of the coordinate system

  demoHelper.createView({
    id: "demoView",
    camera: {
     eye: [0, 5, 2],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  });

  // Within the Scene, create a SceneModel to hold geometry and materials for our model

  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // Create a SceneGeometry that defines the shape of the box

  sceneModel.createGeometry({
    id: "boxGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,

    // Define the SceneGeometry vertices - eight for our box, each
    // one spanning three array elements for X,Y and Z

    positions: [

      1.0, 1.0, 1.0, // v0-v1-v2-v3 front
      -1.0, 1.0, 1.0,
      -1.0, -1.0, 1.0,
      1.0, -1.0, 1.0,

      1.0, 1.0, 1.0, // v0-v3-v4-v1 right
      1.0, -1.0, 1.0,
      1.0, -1.0, -1.0,
      1.0, 1.0, -1.0,

      1.0, 1.0, 1.0, // v0-v1-v6-v1 top
      1.0, 1.0, -1.0,
      -1.0, 1.0, -1.0,
      -1.0, 1.0, 1.0,

      -1.0, 1.0, 1.0,  // v1-v6-v7-v2 left
      -1.0, 1.0, -1.0,
      -1.0, -1.0, -1.0,
      -1.0, -1.0, 1.0,

      -1.0, -1.0, -1.0, // v7-v4-v3-v2 bottom
      1.0, -1.0, -1.0,
      1.0, -1.0, 1.0,
      -1.0, -1.0, 1.0,

      1.0, -1.0, -1.0,  // v4-v7-v6-v1 back
      -1.0, -1.0, -1.0,
      -1.0, 1.0, -1.0,
      1.0, 1.0, -1.0
    ],

    // Define the SceneGeometry indices - these organise the
    // positions coordinates
    // into geometric primitives in accordance
    // with the TrianglesPrimitive parameter,
    // in this case a set of three indices
    // for each triangle. Note that each triangle is specified
    // in counter-clockwise winding order.

    indices: [

      0, 1, 2,   // Front
      0, 2, 3,

      4, 5, 6,  // Right
      4, 6, 7,

      8, 9, 10, // Top
      8, 10, 11,

      12, 13, 14,   // Left
      12, 14, 15,

      16, 17, 18,  // Bottom
      16, 18, 19,

      20, 21, 22,// Back
      20, 22, 23
    ]
  });

  const transformResult = sceneModel.createTransform({
    id: "yellowLegTransform",
    //    parentId: "rootTransform",
    matrix: xeokit.scene.buildMat4({
      position: [0,0,0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
   }),
  });



  // Create a red SceneMesh that instances our SceneGeometry

  const mesh =sceneModel.createMesh({
    id: "boxMesh",
    geometryId: "boxGeometry",
    parentTransformId: "yellowLegTransform",
    // matrix: xeokit.scene.buildMat4({
    //   position: [0, 0, 0], // Default
    //   scale: [1, 1, 1], // Default
    //   rotation: [20, .1, 0], // Default
    // }),


    color: [1.0, 0.0, 0.5] // Default is [1,1,1]
  }).result;


  // Create a SceneObject that aggregates our SceneMesh

  sceneModel.createObject({
    id: "boxObject",
    meshIds: ["boxMesh"]
  });


  transformResult.value.rotation = [0, 0, 0];

  demoHelper.finished();

  let y = 0;
  setInterval(() => {
     view.camera.orbitYaw(1);
   //  view.camera.orbitPitch(.2);
  }, 20);

});



