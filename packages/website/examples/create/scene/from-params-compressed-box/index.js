// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene and rendering APIs used by this example.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared rendering
// context and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  // Access the Scene created by the Studio. The Scene manages the
  // models and renderable content used by the example.
  const { scene } = studio;

  // Create a View with a camera positioned to look at the origin from
  // an elevated angle.
  studio.viewManager.createView({
    camera: {
      eye: [3, 3, 3],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  });

  // Create a SceneModel from a parameter object that includes geometry,
  // meshes, and objects. In this example, the geometry is provided in
  // compressed form using 16-bit quantized vertex positions defined
  // within the specified axis-aligned bounding box.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    geometriesCompressed: [
      {
        id: "boxGeometry",
        primitive: xeokit.base.constants.TrianglesPrimitive, // TrianglesPrimitive
        aabb: [-1, -1, -1, 1, 1, 1],

        // Define quantized vertex positions for the box geometry. These
        // positions are stored as 16-bit unsigned integer values.
        positionsCompressed: [
          65525, 65525, 65525, 0, 65525, 65525, 0, 0, 65525, 65525, 0,
          65525, 65525, 65525, 65525, 65525, 0, 65525, 65525, 0, 0,
          65525, 65525, 0, 65525, 65525, 65525, 65525, 65525, 0, 0,
          65525, 0, 0, 65525, 65525, 0, 65525, 65525, 0, 65525, 0,
          0, 0, 0, 0, 0, 65525, 0, 0, 0, 65525, 0, 0, 65525, 0, 65525,
          0, 0, 65525, 65525, 0, 0, 0, 0, 0, 0, 65525, 0, 65525, 65525, 0
        ],

        // Define triangle indices for the faces of the box.
        indices: [
          0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13,
          14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
        ],

        // Define edge indices for edge rendering or wireframe display.
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
        color: [0.2, 0.2, 1],
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

  // Ensure that the SceneModel was created successfully before continuing.
  if (!sceneModelResult.ok) {
    throw new Error("Unable to create SceneModel: " + sceneModelResult.error);
  }

  // At this point, the View contains a corresponding ViewObject for the
  // SceneObject. That ViewObject can be used to control the appearance
  // of the box within the View.

  // view.objects["boxObject"].setStyleBin("highlighted", true);
  // view.setObjectsInStyleBin("highlighted", view.styleBins.getObjectIds("highlighted"), false);

  // Signal that the demo has finished initializing.
  studio.openInfoPanelFromMeta();
  studio.finished();
});
