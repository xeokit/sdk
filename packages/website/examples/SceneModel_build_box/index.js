// Import the xeokit SDK bundle used by this example. This bundle provides
// the helper utilities along with the scene, model, and rendering APIs
// required to construct and display geometry.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create the demo helper. This helper initializes the rendering context,
// constructs the Scene, and provides convenience methods for setting up
// Views and managing demo lifecycle.
const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  // Access the Scene instance created by the DemoHelper. The Scene manages
  // models, geometry, transforms, and rendering state.
  const { scene } = demoHelper;

  // Create a View with a camera positioned to look at the origin of the
  // coordinate system. The camera is offset slightly to provide a clear
  // perspective of the model.
  const view = demoHelper.createView({
    id: "demoView",
    camera: {
      eye: [0, 5, 2],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  });

  // Create a SceneModel within the Scene. The SceneModel acts as a container
  // for geometry, meshes, transforms, and objects that together define the
  // model content.
  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  // Validate that the SceneModel was created successfully. If creation
  // failed, throw an error with the provided message.
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // Create a SceneGeometry that defines the shape of a box. The geometry is
  // specified using explicit vertex positions and triangle indices.
  sceneModel.createGeometry({
    id: "boxGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,

    // Define the vertex positions for the box. Each vertex consists of three
    // consecutive elements representing X, Y, and Z coordinates. The vertices
    // are arranged per face to allow independent triangle construction.
    positions: [

      1.0, 1.0, 1.0, // Front face
      -1.0, 1.0, 1.0,
      -1.0, -1.0, 1.0,
      1.0, -1.0, 1.0,

      1.0, 1.0, 1.0, // Right face
      1.0, -1.0, 1.0,
      1.0, -1.0, -1.0,
      1.0, 1.0, -1.0,

      1.0, 1.0, 1.0, // Top face
      1.0, 1.0, -1.0,
      -1.0, 1.0, -1.0,
      -1.0, 1.0, 1.0,

      -1.0, 1.0, 1.0, // Left face
      -1.0, 1.0, -1.0,
      -1.0, -1.0, -1.0,
      -1.0, -1.0, 1.0,

      -1.0, -1.0, -1.0, // Bottom face
      1.0, -1.0, -1.0,
      1.0, -1.0, 1.0,
      -1.0, -1.0, 1.0,

      1.0, -1.0, -1.0, // Back face
      -1.0, -1.0, -1.0,
      -1.0, 1.0, -1.0,
      1.0, 1.0, -1.0
    ],

    // Define triangle indices that reference the vertex positions. Each
    // group of three indices defines a triangle in counter-clockwise order,
    // which determines the front-facing side of each triangle.
    indices: [

      0, 1, 2,   // Front
      0, 2, 3,

      4, 5, 6,   // Right
      4, 6, 7,

      8, 9, 10,  // Top
      8, 10, 11,

      12, 13, 14, // Left
      12, 14, 15,

      16, 17, 18, // Bottom
      16, 18, 19,

      20, 21, 22, // Back
      20, 22, 23
    ]
  });

  // Create a transform that defines the spatial placement of the mesh.
  // This transform uses an identity matrix, meaning no translation,
  // rotation, or scaling is applied.
  const transformResult = sceneModel.createTransform({
    id: "yellowLegTransform",
    matrix: xeokit.scene.buildMat4({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }),
  });

  // Create a mesh that instances the box geometry and attaches it to the
  // transform. The mesh defines the visual appearance of the geometry.
  const mesh = sceneModel.createMesh({
    id: "boxMesh",
    geometryId: "boxGeometry",
    parentTransformId: "yellowLegTransform",

    // Assign a color to the mesh. This example uses a pinkish tone.
    color: [1.0, 0.0, 0.5]
  }).result;

  // Create a SceneObject that aggregates the mesh. SceneObjects are the
  // entities that Views interact with for selection, highlighting, and
  // visibility control.
  sceneModel.createObject({
    id: "boxObject",
    meshIds: ["boxMesh"]
  });

  // Signal that initialization is complete. This typically hides any
  // loading UI managed by the DemoHelper.
  demoHelper.finished();

  // Continuously orbit the camera around the model to demonstrate the
  // scene in motion. This produces a simple rotation around the Y axis.
  let y = 0;
  setInterval(() => {
    view.camera.orbitYaw(1);
    // view.camera.orbitPitch(0.2);
  }, 20);

});