// Import xeokit SDK via the JavaScript bundle that we've built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold model geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Viewer which uses the WebGLRenderer to render the Scene

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer: new xeokit.webglrenderer.WebGLRenderer({})
});

const demoHelper = new DemoHelper({
  elementId: "info-container",
  viewer
});

demoHelper.init()
  .then(() => {

    // Create a View that renders to a canvas in the DOM

    const view = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    // Set the View's World-space coordinate axis to make +Z "up"

    view.camera.worldAxis = [
      1, 0, 0, // Right +X
      0, 0, 1, // Up +Z
      0, -1, 0  // Forward -Y
    ];

    // Arrange the View's Camera within our +Z "up" coordinate system

    view.camera.eye = [15, 10, 0];
    view.camera.look = [0, 0, 0];
    view.camera.up = [0, 0, 1];

    view.camera.orbitPitch(20);

    // Add a CameraControl to interactively control the Camera with keyboard,
    // mouse and touch input

    new xeokit.cameracontrol.CameraControl(view);

    // Create a SceneModel to hold geometry and materials

    const sceneModel = scene.createModel({
      id: "demoModel"
    });

    // Create a box-shaped SceneGeometry, which we'll reuse for the tabletop and legs.

    sceneModel.createGeometry({
      id: "demoBoxGeometry",
      primitive: xeokit.constants.TrianglesPrimitive,
      positions: [
        1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
        -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
        -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
      ],
      indices: [
        0, 1, 2, 0, 2, 3,            // front
        4, 5, 6, 4, 6, 7,            // right
        8, 9, 10, 8, 10, 11,         // top
        12, 13, 14, 12, 14, 15,      // left
        16, 17, 18, 16, 18, 19,      // bottom
        20, 21, 22, 20, 22, 23
      ]
    });

    // Create SceneObjects to represent the tabletop and legs. Each SceneObject
    // gets a SceneMesh that instances the SceneGeometry, configured with a color
    // and a 4x4 modeling transform matrix to apply to the SceneGeometry's
    // vertex positons.

    sceneModel.createMesh({
      id: "redLegMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [-4, -6, -4],
        scale: [1, 3, 1]
      }),
      color: [1, 0.3, 0.3]
    });

    sceneModel.createObject({
      id: "redLeg",
      meshIds: ["redLegMesh"]
    });

    sceneModel.createMesh({
      id: "greenLegMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [4, -6, -4],
        scale: [1, 3, 1]
      }),
      color: [0.3, 1.0, 0.3]
    });

    sceneModel.createObject({
      id: "greenLeg",
      meshIds: ["greenLegMesh"]
    });

    sceneModel.createMesh({
      id: "blueLegMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [4, -6, 4],
        scale: [1, 3, 1]
      }),
      color: [0.3, 0.3, 1.0]
    });

    sceneModel.createObject({
      id: "blueLeg",
      meshIds: ["blueLegMesh"]
    });

    sceneModel.createMesh({
      id: "yellowLegMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [-4, -6, 4],
        scale: [1, 3, 1]
      }),
      color: [1.0, 1.0, 0.0]
    });

    sceneModel.createObject({
      id: "yellowLeg",
      meshIds: ["yellowLegMesh"]
    });

    sceneModel.createMesh({
      id: "purpleTableTopMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [0, -3, 0],
        scale: [6, 0.5, 6]
      }),
      color: [1.0, 0.3, 1.0]
    });

    sceneModel.createObject({
      id: "purpleTableTop",
      meshIds: ["purpleTableTopMesh"]
    });

    // The View will now contain a ViewObject for each
    // SceneObject in the SceneModel.

    demoHelper.finished();
  });
