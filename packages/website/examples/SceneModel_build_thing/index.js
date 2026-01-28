// Import the SDK from a bundle built for these examples.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up the Scene, Viewer, and WebGLRenderer used by this demo.
import { DemoHelper } from "../../js/DemoHelper.js";

const demoHelper = new DemoHelper({});

demoHelper.init({ logging: false }).then(({
                                            scene,
                                            viewer,
                                            view,
                                            renderer
                                          }) => {

  // Position the View's camera.
  view.camera.eye  = [15, -25, 15];
  view.camera.look = [0, 0, 0];
  view.camera.up   = [0, 0, 1];

  view.camera.perspectiveProjection.far = 100000;

  // Create a SceneModel to hold our geometries, meshes, and objects.
  const sceneModelRes = scene.createModel({ id: "simpleShapes" });
  if (!sceneModelRes.ok) {
    throw new Error(sceneModelRes.error);
  }
  const sceneModel = sceneModelRes.value;

  // ---------------------------------------------------------------------------
  // 1) Define reusable geometries
  // ---------------------------------------------------------------------------

  // Unit cube geometry
  const boxGeomRes = sceneModel.createGeometry({
    id: "boxGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,
    positions: [
      1,  1,  1,  -1,  1,  1,  -1, -1,  1,   1, -1,  1,
      1,  1, -1,  -1,  1, -1,  -1, -1, -1,   1, -1, -1
    ],
    indices: [
      0, 1, 2,  0, 2, 3,     // +Z
      4, 7, 6,  4, 6, 5,     // -Z
      4, 5, 1,  4, 1, 0,     // +Y
      3, 2, 6,  3, 6, 7,     // -Y
      0, 3, 7,  0, 7, 4,     // +X
      1, 5, 6,  1, 6, 2      // -X
    ]
  });
  if (!boxGeomRes.ok) {
    throw new Error(boxGeomRes.error);
  }

  // Pyramid geometry (square base, apex on +Z)
  const pyramidGeomRes = sceneModel.createGeometry({
    id: "pyramidGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,
    positions: [
      -1, -1, 0,
      1, -1, 0,
      1,  1, 0,
      -1,  1, 0,
      0,  0, 1.5
    ],
    indices: [
      0, 1, 2,  0, 2, 3,  // base
      0, 1, 4,
      1, 2, 4,
      2, 3, 4,
      3, 0, 4
    ]
  });
  if (!pyramidGeomRes.ok) {
    throw new Error(pyramidGeomRes.error);
  }

  // NEW: Cylinder geometry (simple round column, aligned to +Z)
  // - Uses a triangle fan for top/bottom caps and triangles for the side.
  const createCylinderGeometry = ({
                                    id,
                                    radius = 1.0,
                                    height = 2.0,
                                    radialSegments = 24
                                  }) => {
    const positions = [];
    const indices = [];

    const halfH = height * 0.5;

    // Ring vertices: bottom then top
    for (let i = 0; i < radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2.0;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius;

      positions.push(x, y, -halfH); // bottom ring
      positions.push(x, y,  halfH); // top ring
    }

    const bottomCenterIndex = positions.length / 3;
    positions.push(0, 0, -halfH);

    const topCenterIndex = positions.length / 3;
    positions.push(0, 0, halfH);

    // Side faces
    for (let i = 0; i < radialSegments; i++) {
      const next = (i + 1) % radialSegments;

      const b0 = i * 2;
      const t0 = b0 + 1;
      const b1 = next * 2;
      const t1 = b1 + 1;

      // Two triangles per quad
      indices.push(b0, b1, t0);
      indices.push(t0, b1, t1);
    }

    // Bottom cap (faces downward, so winding is flipped)
    for (let i = 0; i < radialSegments; i++) {
      const next = (i + 1) % radialSegments;
      const b0 = i * 2;
      const b1 = next * 2;
      indices.push(bottomCenterIndex, b1, b0);
    }

    // Top cap (faces upward)
    for (let i = 0; i < radialSegments; i++) {
      const next = (i + 1) % radialSegments;
      const t0 = i * 2 + 1;
      const t1 = next * 2 + 1;
      indices.push(topCenterIndex, t0, t1);
    }

    const geomRes = sceneModel.createGeometry({
      id,
      primitive: xeokit.constants.TrianglesPrimitive,
      positions,
      indices
    });

    if (!geomRes.ok) {
      throw new Error(geomRes.error);
    }
  };

  createCylinderGeometry({
    id: "cylinderGeometry",
    radius: 1.0,
    height: 2.2,
    radialSegments: 28
  });

  // ---------------------------------------------------------------------------
  // 2) Helper: one mesh per object
  // ---------------------------------------------------------------------------

  const createObjectWithMesh = ({
                                  id,
                                  geometryId,
                                  position,
                                  scale,
                                  color
                                }) => {

    const meshId = `${id}Mesh`;

    const meshRes = sceneModel.createMesh({
      id: meshId,
      geometryId,
      matrix: xeokit.scene.buildMat4({ position, scale }),
      color
    });

    if (!meshRes.ok) {
      throw new Error(meshRes.error);
    }

    const objRes = sceneModel.createObject({
      id,
      meshIds: [meshId]
    });

    if (!objRes.ok) {
      throw new Error(objRes.error);
    }
  };

  // ---------------------------------------------------------------------------
  // 3) Create four objects
  // ---------------------------------------------------------------------------

  // Cube
  createObjectWithMesh({
    id: "cube",
    geometryId: "boxGeometry",
    position: [-6, 0, 0],
    scale: [2, 2, 2],
    color: [0.2, 0.6, 1.0]
  });

  // Pyramid
  createObjectWithMesh({
    id: "pyramid",
    geometryId: "pyramidGeometry",
    position: [-2, 0, 0],
    scale: [2, 2, 2],
    color: [1.0, 0.7, 0.2]
  });

  // Tall box
  createObjectWithMesh({
    id: "tower",
    geometryId: "boxGeometry",
    position: [2, 0, 0],
    scale: [1.5, 1.5, 5.0],
    color: [0.8, 0.3, 0.9]
  });

  // NEW: Cylinder
  createObjectWithMesh({
    id: "cylinder",
    geometryId: "cylinderGeometry",
    position: [6, 0, 0],
    scale: [2.0, 2.0, 2.0],
    color: [0.3, 0.9, 0.5]
  });

  // Enable orbit controls.
  new xeokit.cameracontrol.CameraControl(view);

  // Signal that the demo is ready.
  demoHelper.finished();

  // Expose viewer for debugging.
  window.viewer = viewer;
});
