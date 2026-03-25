// Import the xeokit SDK bundle used by this example.
// This provides rendering, scene management, and helper utilities.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up a ready-to-use Scene, View, and Renderer.
const demoHelper = new xeokit.demo.DemoHelper({});

// Initialize everything, then build the scene.
demoHelper.init().then(() => {

  // Core components:
  // - scene: holds geometry and models
  // - view: manages camera and rendering
  // - renderer: handles drawing and picking (mouse interaction)
  const {scene, renderer} = demoHelper;

  // Position the camera in a large coordinate space.
  // This demonstrates xeokit's ability to handle high-precision values.

  demoHelper.createView({
    camera: {
      eye: [1000000000000, 0, 20],
      look: [1000000000000, -5, 0],
      up: [0, 1, 0]
    }
  });

  // Create a SceneModel to store geometry, meshes, and objects.
  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  // Always check Result objects before using them.
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // Populate the model with:
  // - a reusable box geometry
  // - multiple meshes forming a table
  // - objects grouping meshes for interaction
  const fromParamsResult = sceneModel.fromParams({
    geometries: [
      {
        id: "demoBoxGeometry",
        primitive: xeokit.constants.TrianglesPrimitive,

        // Vertex positions (XYZ triplets) defining a cube.
        positions: [
          1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
          -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
          -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
        ],

        // Indices defining triangles from the positions array.
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

    // Meshes are instances of the geometry with transforms and colors.
    meshes: [
      {
        id: "redLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [1000000000000 - 4, -6, -4],
        scale: [1, 3, 1],
        color: [1, 0.3, 0.3]
      },
      {
        id: "greenLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [1000000000000 + 4, -6, -4],
        scale: [1, 3, 1],
        color: [0.3, 1.0, 0.3]
      },
      {
        id: "blueLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [1000000000000 + 4, -6, 4],
        scale: [1, 3, 1],
        color: [0.3, 0.3, 1.0]
      },
      {
        id: "yellowLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [1000000000000 - 4, -6, 4],
        scale: [1, 3, 1],
        color: [1.0, 1.0, 0.0]
      },
      {
        id: "tableTop-mesh",
        geometryId: "demoBoxGeometry",
        position: [1000000000000, -3, 0],
        scale: [6, 0.5, 6],
        color: [1.0, 0.3, 1.0]
      }
    ],

    // Objects group meshes into logical entities for picking and visibility.
    objects: [
      { id: "redLeg", meshIds: ["redLeg-mesh"] },
      { id: "greenLeg", meshIds: ["greenLeg-mesh"] },
      { id: "blueLeg", meshIds: ["blueLeg-mesh"] },
      { id: "yellowLeg", meshIds: ["yellowLeg-mesh"] },
      { id: "purpleTableTop", meshIds: ["tableTop-mesh"] }
    ]
  });

  if (!fromParamsResult.ok) {
    throw new Error("Unable to populate SceneModel: " + fromParamsResult.error);
  }

  // Create a small sphere to visualize picked positions.
  const sphereResult = xeokit.procgen.buildSphereGeometry({
    center: [0, 0, 0],
    radius: 0.2,
    heightSegments: 12,
    widthSegments: 12
  });

  if (!sphereResult.ok) {
    throw new Error(sphereResult.error);
  }

  const sphere = sphereResult.value;

  // Add the sphere marker to the scene.
  sceneModel.fromParams({
    geometries: [{
      id: "sphereGeometry",
      primitive: xeokit.constants.TrianglesPrimitive,
      positions: sphere.positions,
      indices: sphere.indices
    }],
    meshes: [{
      id: "sphereMesh",
      geometryId: "sphereGeometry",
      color: [0, 0.5, 1],

      // Full transform matrix (we’ll update this dynamically).
      matrix: xeokit.scene.buildMat4({
        position: [0, 0, 0]
      })
    }],
    objects: [{
      id: "sphereObject",
      meshIds: ["sphereMesh"]
    }]
  });

  // Access the sphere in the View for visibility control.
  const sphereViewObject = view.objects["sphereObject"];

  // Prevent the marker from interfering with picking.
  sphereViewObject.pickable = false;

  // Hide it until something is picked.
  sphereViewObject.visible = false;

  // Access the mesh so we can move it.
  const sphereMesh = sceneModel.meshes["sphereMesh"];

  // Track mouse movement and perform picking.
  view.htmlElement.addEventListener("mousemove", (e) => {

    const result = renderer.pick(view, {
      canvasPos: [e.offsetX, e.offsetY],
      pickViewObject: true
    });

    if (result.ok && result.value) {

      const { sceneMesh, worldPos } = result.value;

      // If we hit a mesh, show and move the marker.
      if (sceneMesh) {
        sphereViewObject.visible = true;

        if (worldPos) {
          sphereMesh.matrix = xeokit.scene.buildMat4({
            position: worldPos
          });
        }

      } else {
        sphereViewObject.visible = false;
      }

    } else {
      sphereViewObject.visible = false;
    }
  });

  // Signal that setup is complete.
  demoHelper.finished();
});
