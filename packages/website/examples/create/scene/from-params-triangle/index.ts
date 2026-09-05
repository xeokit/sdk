// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene and rendering APIs used by this example.
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {createStandaloneRuntime, failExample, finishExample, mustOk} from "../../../utils/standaloneRuntime.js";

const {scene, view, renderer} = await createStandaloneRuntime({
  viewParams: {
    camera: {
      eye: [3, 3, 3],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  }
});

try {

      // Create a SceneModel and populate it directly from parameters.
      // The model defines a simple triangle geometry, a mesh that
      // instances that geometry, and an object that wraps the mesh.
      const sceneModelResult = scene.createModel({
        id: "demoModel",
        geometries: [
          {
            id: "triangleGeometry",
            primitive: TrianglesPrimitive,
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
      mustOk(sceneModelResult);

      // At this point, the View contains a corresponding ViewObject for the
      // SceneObject. That ViewObject can be used to control the appearance
      // of the triangle within the View.

      // view.objects["triangleObject"].setStyleBin("highlighted", true);

      // Signal that the demo has finished initializing.
      finishExample(renderer, view);
} catch (error) {
  failExample("from-params-triangle", error);
}
