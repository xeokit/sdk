// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene and rendering APIs used by this example.
import {PointsPrimitive} from "@xeokit/sdk/base/constants";
import {buildMat4} from "@xeokit/sdk/model/scene";
import {createStandaloneRuntime, failExample, finishExample, mustOk} from "../../../utils/standaloneRuntime.js";

const {scene, view, renderer} = await createStandaloneRuntime({
  viewParams: {
    camera: {
      eye: [0, 8, 6],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  }
});

try {

  // Create a SceneModel to hold the generated geometry, meshes, and
  // objects used by this example.
  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  // Ensure that the SceneModel was created successfully before continuing.
  const sceneModel = mustOk(sceneModelResult);

  // Generate a random point cloud. The points are distributed within a
  // cube centered at the origin, and each point is assigned a random color.
  const N = 20000;
  const spread = 10;

  const positions = [];
  const colors = [];

  for (let i = 0; i < N; i++) {

    // Compute a random point position within the bounds of the cube.
    const x = (Math.random() - 0.5) * spread;
    const y = (Math.random() - 0.5) * spread;
    const z = (Math.random() - 0.5) * spread;

    positions.push(x, y, z);

    // Assign a random RGBA color to the point.
    colors.push(
        Math.random(),
        Math.random(),
        Math.random(),
        1.0
    );
  }

  // Create a points geometry from the generated positions and colors.
  sceneModel.createGeometry({
    id: "pointsGeometry",
    primitive: PointsPrimitive,
    positions,
    colors
  });

  // Create a transform for the point cloud. In this example, the transform
  // is the identity transform and leaves the geometry in place.
  const transformResult = sceneModel.createTransform({
    id: "pointsTransform",
    matrix: buildMat4({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }),
  });

  // Create a mesh that instances the points geometry.
  const meshResult = sceneModel.createMesh({
    id: "pointsMesh",
    geometryId: "pointsGeometry",
    parentTransformId: "pointsTransform",
    color: [1.0, 1.0, 1.0]
  });

  // Ensure that the mesh was created successfully before continuing.
  if (!meshResult.ok) {
    throw new Error(meshResult.error);
  }

  // Create an object that aggregates the point cloud mesh so it can be
  // managed as a single logical entity.
  sceneModel.createObject({
    id: "pointsObject",
    meshIds: ["pointsMesh"]
  });

  // Signal that setup has completed.
  finishExample(renderer, view);

  // Continuously orbit the camera to provide a simple animated view
  // of the point cloud.
  setInterval(() => {
    view.camera.orbitYaw(0.5);
  }, 20);
} catch (error) {
  failExample("points", error);
}
