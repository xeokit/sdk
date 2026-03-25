// Import the SDK from a bundle built for these examples.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const { scene} = demoHelper;

  demoHelper.createView({
      camera: {
        eye: [0, 8, 6],
        look: [0, 0, 0],
        up: [0, 0, 1]
      }
  });

  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // ----------------------------
  // Generate N random points
  // ----------------------------

  const N = 20000;           // Number of points
  const spread = 10;        // Size of point cloud cube

  const positions = [];
  const colors = [];

  for (let i = 0; i < N; i++) {

    // Random position in cube centered at origin
    const x = (Math.random() - 0.5) * spread;
    const y = (Math.random() - 0.5) * spread;
    const z = (Math.random() - 0.5) * spread;

    positions.push(x, y, z);

    // Random RGBA color
    colors.push(
      Math.random(),
      Math.random(),
      Math.random(),
      1.0
    );
  }

  sceneModel.createGeometry({
    id: "pointsGeometry",
    primitive: xeokit.constants.PointsPrimitive,
    positions,
    colors
  });

  const transformResult = sceneModel.createTransform({
    id: "pointsTransform",
    matrix: xeokit.scene.buildMat4({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }),
  });

  const meshResult = sceneModel.createMesh({
    id: "pointsMesh",
    geometryId: "pointsGeometry",
    parentTransformId: "pointsTransform",
    color: [1.0, 1.0, 1.0]
  });

  if (!meshResult.ok) {
    throw new Error(meshResult.error);
  }

  sceneModel.createObject({
    id: "pointsObject",
    meshIds: ["pointsMesh"]
  });

  demoHelper.finished();

  // Rotate camera for visual effect
  setInterval(() => {
    view.camera.orbitYaw(0.5);
  }, 20);
});
