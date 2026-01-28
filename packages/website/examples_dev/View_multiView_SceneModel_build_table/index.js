// Import xeokit SDK from a JS bundle built specially for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that viewManager our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

const demoHelper = new DemoHelper({
  elementId: "info-container",
  viewer
});

demoHelper.init()
  .then(() => {

    // Create the first View, with perspective projection, looking at the Scene from the side

    const view1 = viewer.createView({
      id: "demoView1",
      elementId: "demoCanvas1"
    });

    view1.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
    view1.camera.eye = [0, -5, 20];
    view1.camera.look = [0, -5, 0];
    view1.camera.up = [0, 1, 0];
    view1.edges.enabled = true;

    // Create the second View, with orthographic projection, looking at the Scene from above

    const view2 = viewer.createView({
      id: "demoView2",
      elementId: "demoCanvas2"
    });

    view2.camera.projectionType = xeokit.constants.OrthoProjectionType;
    view2.camera.eye = [0, -5, 25];
    view2.camera.look = [0, -5, 0];
    view2.camera.up = [0, 1, 0];
    view2.camera.orthoProjection.scale = 20;
    view2.camera.orbitPitch(90);

    // Create the third View, with perspective projection, looking at the Scene from the front

    const view3 = viewer.createView({
      id: "demoView3",
      elementId: "demoCanvas3"
    });

    view3.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
    view3.camera.eye = [0, -5, 20];
    view3.camera.look = [0, -5, 0];
    view3.camera.up = [0, 1, 0];
    view3.camera.zoom(2);
    view3.camera.orbitYaw(-50);
    view3.camera.orbitPitch(20);

    // Attach CameraControls to the Views, to control
    // each View independently with keyboard, mouse and touch input

    const cameraControl1 = new xeokit.cameracontrol.CameraControl(view1, {});
    const cameraControl2 = new xeokit.cameracontrol.CameraControl(view2, {});
    const cameraControl3 = new xeokit.cameracontrol.CameraControl(view3, {});

    // Create SceneModel to hold geometry and materials

    const sceneModel = scene.createModel({
      id: "demoModel"
    });

    if (sceneModel instanceof xeokit.core.SDKError) {
      log(`Error creating SceneModel: ${sceneModel.message}`);
    }

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

    // Each of our three Views will now contain five
    // ViewObjects corresponding to the SceneObjects in our SceneModel. Each
    // ViewObject has the same ID as its SceneObject. Put differently, each SceneObject has
    // three ViewObjects that have its ID, with each of the three ViewObjects
    // residing in a different View. Through these ViewObjects, we can update the
    // appearance of our model elements in that View.

    viewer.views["demoView1"].objects["greenLeg"].colorize = [0.3, 1, 1];
    viewer.views["demoView2"].objects["greenLeg"].colorize = [0.3, 1.0, 0.3];
    viewer.views["demoView3"].objects["greenLeg"].colorize = [1, 0.3, 0.3];

    viewer.views["demoView1"].objects["purpleTableTop"].colorize = [0.3, 1, 1];
    viewer.views["demoView2"].objects["purpleTableTop"].colorize = [0.3, 1.0, 0.3];
    viewer.views["demoView3"].objects["purpleTableTop"].colorize = [1, 0.3, 0.3];

    viewer.onTick.subscribe(() => {
      // view1.camera.orbitYaw(.5);
      view3.camera.orbitYaw(-1.3);
      // view2.camera.orbitPitch(3);
    });

    let toggle = false;
    setInterval(() => {
      viewer.views["demoView1"].objects["purpleTableTop"].colorize = (toggle = !toggle) ? [0.3, 1, 1] : [1, 0.3, 0.3];
    }, 2000);


    demoHelper.finished();
  });

