// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene and rendering APIs used by this example.
import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared rendering
// context and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({});

studio
    .init()
    .then(() => {

      // Access the Scene created by the Studio. The Scene manages the
      // models and renderable content used by the example.
      const { scene } = studio;

      // Create a View with a perspective camera positioned to frame the
      // table model from a three-quarter angle that keeps the ground plane
      // around the legs in shot, so the shadows the table casts on z = 0
      // remain visible.
      studio.viewManager.createView({
        camera: {
          projection: "perspective",
          far: 1000000,
          eye:  [14, -14, 10],
          look: [0,  0,   3],
          up:   [0,  0,   1]
        }
      });

      // Create a SceneModel to hold the model geometry, meshes, and objects.
      // The model content is then populated from a parameter object that
      // follows the SceneModelParams schema.
      const sceneModelResult = scene.createModel({
        id: "demoModel"
      });

      // Stop if the SceneModel could not be created.
      if (!sceneModelResult.ok) {
        return;
      }

      const sceneModel = sceneModelResult.value;

      // Populate the SceneModel from structured parameters. This defines
      // shared geometry, mesh instances, and scene objects in a single step.
      const fromParamsResult = sceneModel.fromParams({
        geometries: [
          {
            id: "demoBoxGeometry",
            primitive: xeokit.base.constants.TrianglesPrimitive,
            positions: [
              1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
              -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
              -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
            ],

            // Define UV coordinates for the shared box geometry. These map
            // texture space consistently across each face of the box.
            uvs: [
              1, 0, 0, 0, 0, 1, 1, 1,
              0, 0, 0, 1, 1, 1, 1, 0,
              1, 1, 1, 0, 0, 0, 0, 1,
              1, 0, 0, 0, 0, 1, 1, 1,
              0, 1, 1, 1, 1, 0, 0, 0,
              0, 1, 1, 1, 1, 0, 0, 0
            ],

            // Define triangle indices for the six faces of the box.
            indices: [
              0, 1, 2, 0, 2, 3,
              4, 5, 6, 4, 6, 7,
              8, 9, 10, 8, 10, 11,
              12, 13, 14, 12, 14, 15,
              16, 17, 18, 16, 18, 19,
              20, 21, 22, 20, 22, 23
            ]
          }
        ],

        // Create mesh instances from the shared box geometry. Each mesh
        // applies its own transform and color to represent part of the table.
        // Transforms are written for the SDK's default +Z-up coordinate
        // system: legs are tall along Z, the tabletop is flat in the X-Y
        // plane, and the model sits on the z = 0 ground plane.
        meshes: [
          {
            id: "redLeg-mesh",
            geometryId: "demoBoxGeometry",
            position: [-4, -4, 3],
            scale: [1, 1, 3],
            rotation: [0, 0, 0],
            color: [1, 0.3, 0.3],
            // opacity: 0.5
          },
          {
            id: "greenLeg-mesh",
            geometryId: "demoBoxGeometry",
            position: [4, -4, 3],
            scale: [1, 1, 3],
            rotation: [0, 0, 0],
            color: [0.3, 1.0, 0.3]
          },
          {
            id: "blueLeg-mesh",
            geometryId: "demoBoxGeometry",
            position: [4, 4, 3],
            scale: [1, 1, 3],
            rotation: [0, 0, 0],
            color: [0.3, 0.3, 1.0]
          },
          {
            id: "yellowLeg-mesh",
            geometryId: "demoBoxGeometry",
            position: [-4, 4, 3],
            scale: [1, 1, 3],
            rotation: [0, 0, 0],
            color: [1.0, 1.0, 0.0]
          },
          {
            id: "tableTop-mesh",
            geometryId: "demoBoxGeometry",
            position: [0, 0, 6],
            scale: [6, 6, 0.5],
            rotation: [0, 0, 0],
            color: [1.0, 0.3, 1.0]
          }
        ],

        // Create scene objects that wrap the meshes as logical entities.
        objects: [
          {
            id: "redLeg",
            meshIds: ["redLeg-mesh"]
          },
          {
            id: "greenLeg",
            meshIds: ["greenLeg-mesh"]
          },
          {
            id: "blueLeg",
            meshIds: ["blueLeg-mesh"]
          },
          {
            id: "yellowLeg",
            meshIds: ["yellowLeg-mesh"]
          },
          {
            id: "purpleTableTop",
            meshIds: ["tableTop-mesh"]
          }
        ]
      });

      // Ensure that the SceneModel was populated successfully before
      // completing the demo setup.
      if (!fromParamsResult.ok) {
        throw new Error("Unable to populate SceneModel from params: " + fromParamsResult.error);
      }

      // Signal that the demo has finished initializing.
   //   studio.openInfoPanelFromMeta();
      studio.finished();
    });
