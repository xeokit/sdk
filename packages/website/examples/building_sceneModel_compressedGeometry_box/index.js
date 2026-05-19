// Import the xeokit SDK bundle used by this example. This bundle provides the
// scene, model, and view APIs that are required to construct and render
// geometry within the demo.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper is responsible for initializing the
// rendering context, creating the scene, and wiring together the utilities
// needed to run this example.
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  // Access the Scene instance that was created and initialized by the
  // Studio. The Scene manages models, geometry, and rendering state.
  const { scene } = studio;

  // Create a View with a camera positioned to look at the origin of the
  // world coordinate system. The camera is placed slightly above and away
  // from the origin to provide a clear perspective of the model.
  const view = studio.viewManager.createView({
    id: "demoView",
    camera: {
      eye: [0, 5, 2],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  });

  // Create a SceneModel that will contain geometry, meshes, and objects.
  // The SceneModel acts as a container for all renderable content in this
  // example.
  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  // Validate that the SceneModel was created successfully. If creation
  // failed, throw an error with the provided message.
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.message);
  }

  const sceneModel = sceneModelResult.value;

  // Define compressed geometry for a unit cube. This geometry uses
  // quantized vertex positions to reduce memory usage and improve
  // performance when transferring data to the GPU.
  sceneModel.createGeometryCompressed({
    id: "boxGeometry",

    // Specify that the geometry is composed of triangles.
    primitive: xeokit.base.constants.TrianglesPrimitive,

    // Define the axis-aligned bounding box of the geometry.
    aabb: [-1, -1, -1, 1, 1, 1],

    // Provide quantized vertex positions in compressed form.
    positionsCompressed: [
      65525, 65525, 65525, 0, 65525, 65525, 0, 0, 65525, 65525, 0,
      65525, 65525, 65525, 65525, 65525, 0, 65525, 65525, 0, 0,
      65525, 65525, 0, 65525, 65525, 65525, 65525, 65525, 0, 0,
      65525, 0, 0, 65525, 65525, 0, 65525, 65525, 0, 65525, 0,
      0, 0, 0, 0, 0, 65525, 0, 0, 0, 65525, 0, 0, 65525, 0, 65525,
      0, 0, 65525, 65525, 0, 0, 0, 0, 0, 0, 65525, 0, 65525, 65525, 0
    ],

    // Define triangle indices that describe the faces of the cube.
    indices: [
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ],

    // Define edge indices that can be used for wireframe or edge rendering.
    edgeIndices: [
      8, 12, 12, 19, 19, 18, 8, 18,
      18, 20, 20, 23, 8, 23,
      23, 22, 12, 22, 22, 21,
      19, 21, 20, 21
    ]
  });

  // Create a mesh that instances the cube geometry. The mesh defines the
  // transform and appearance of the geometry within the SceneModel.
  sceneModel.createMesh({
    id: "boxMesh",
    geometryId: "boxGeometry",

    // Specify the transform of the mesh. These values correspond to the
    // default identity transform.
    position: [0, 0, 0],
    scale: [1, 1, 1],
    rotation: [0, 0, 0],

    // Assign a red color to the mesh.
    color: [1.0, 0.0, 0.0]
  });

  // Create a SceneObject that references the mesh. SceneObjects are the
  // entities that Views interact with for selection, highlighting, and
  // visibility control.
  sceneModel.createObject({
    id: "boxObject",
    meshIds: ["boxMesh"]
  });

  // The View now contains a corresponding ViewObject with the same ID as
  // the SceneObject. This allows the View to control how the object is
  // presented within that specific View.
  view.objects["boxObject"].highlighted = true;

  // Immediately clear the highlight state for demonstration purposes.
  view.setObjectsHighlighted(view.highlightedObjectIds, false);

  // Signal that the demo has finished initializing. This typically hides
  // any loading indicators managed by the Studio.
  studio.finished();
});