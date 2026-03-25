// Import the xeokit SDK bundle used by this example.
// This includes the core engine plus some demo utilities.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up a ready-to-use Scene, View, and Renderer.
// This saves us from manually wiring up WebGL and boilerplate.
const demoHelper = new xeokit.demo.DemoHelper({});

// Initialize everything, then build our scene.
demoHelper.init().then(() => {

  // These are the main pieces we’ll work with:
  // - scene: stores models and geometry
  // - view: handles camera + rendering state
  // - renderer: does drawing and picking (mouse interaction)
  const { scene, renderer} = demoHelper;

  // Position the camera in a very large coordinate space.
  // xeokit supports high-precision rendering even at huge values.

  demoHelper.createView({
    camera: {
      eye: [1000000000000, 0, 20],  // where the camera is
      look: [1000000000000, -5, 0], // what it looks at
      up: [0, 1, 0]                 // which direction is "up"
    }
  });

  // Create a SceneModel, which is a container for geometry, meshes, and objects.
  // We define a coordinate system so xeokit knows how to interpret axes and units.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // +X = right
        0, 1, 0, // +Y = up
        0, 0, 1  // +Z = forward
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  // Many xeokit calls return a Result object.
  // Always check .ok before using .value.
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // Populate the model using JSON-style parameters.
  // We define:
  // - one reusable box geometry
  // - several meshes (table legs + tabletop)
  // - objects that group meshes for interaction
  const fromParamsResult = sceneModel.fromParams({
    geometries: [
      {
        id: "demoBoxGeometry",
        primitive: xeokit.constants.TrianglesPrimitive,

        // Raw vertex positions (XYZ triplets).
        // This defines a cube with duplicated vertices per face.
        positions: [
          1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
          -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
          -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
        ],

        // Indices define triangles using the positions above.
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

    // Each mesh is an instance of the box geometry with its own transform + color.
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

    // Objects group meshes into logical units for picking and visibility.
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

  // Create a small sphere geometry using xeokit's procedural helper.
  // We'll use this as a visual marker for picked positions.
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

  // Add the sphere to the scene.
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

      // The matrix controls full transform (position/rotation/scale).
      // We'll update this dynamically.
      matrix: xeokit.scene.buildMat4({
        position: [0, 0, 0]
      })
    }],
    objects: [{
      id: "sphereObject",
      meshIds: ["sphereMesh"]
    }]
  });

  // Access the view-level object so we can control visibility.
  const sphereViewObject = view.objects["sphereObject"];

  // Prevent the marker from interfering with picking.
  sphereViewObject.pickable = false;

  // Hide it until we actually hit something.
  sphereViewObject.visible = false;

  // Access the mesh so we can move it.
  const sphereMesh = sceneModel.meshes["sphereMesh"];

  // Listen for mouse movement over the canvas.
  view.htmlElement.addEventListener("mousemove", (e) => {

    // Perform a pick (raycast) into the scene.
    const result = renderer.pick(view, {
      canvasPos: [e.offsetX, e.offsetY],
      pickViewObject: true
    });

    if (result.ok && result.value) {

      const { sceneMesh, worldPos } = result.value;

      // If we hit a mesh, show the marker.
      if (sceneMesh) {
        sphereViewObject.visible = true;

        // Move the marker to the exact 3D position under the cursor.
        if (worldPos) {
          sphereMesh.matrix = xeokit.scene.buildMat4({
            position: worldPos
          });
        }

      } else {
        // Nothing hit → hide marker.
        sphereViewObject.visible = false;
      }

    } else {
      // Pick failed → hide marker.
      sphereViewObject.visible = false;
    }
  });

  // Signal that setup is complete.
  demoHelper.finished();
});
