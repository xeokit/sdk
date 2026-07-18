// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene and rendering APIs used by this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared rendering
// context and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({});

studio
    .init()
    .then(() => {

      // Access the View and Scene subsystems created by the Studio.
      // The Scene manages renderable content, while Views control how
      // that content is presented.
      const { view, scene } = studio;

      // Create a View with a camera positioned to look at the origin
      // from an elevated angle.
      studio.viewManager.createView({
        camera: {
          eye: [3, 3, 3],
          look: [0, 0, 0],
          up: [0, 0, 1]
        }
      });

      // Create a SceneModel and populate it directly from parameters.
      // The model defines a simple triangle geometry, a mesh that
      // instances that geometry, and an object that wraps the mesh.
      const sceneModelResult = scene.createModel({
        id: "demoModel",
        geometries: [
          {
            id: "triangleGeometry",
            primitive: 20002, // TrianglesPrimitive
            positions: [
              -1.5, 0.0, 0.0,
              1.5, 0.0, 0.0,
              0.0, 0.0, 2.598076211,
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

      // Ensure that the SceneModel was created successfully before continuing.
      if (!sceneModelResult.ok) {
        throw new Error("Unable to create SceneModel: " + sceneModelResult.error);
      }

      // At this point, the View contains a corresponding ViewObject for the
      // SceneObject. That ViewObject can be used to control the appearance
      // of the triangle within the View.

      // view.objects["triangleObject"].highlighted = true;

      // Signal that the demo has finished initializing.
      studio.openInfoPanelFromMeta();
      studio.finished();

    });
