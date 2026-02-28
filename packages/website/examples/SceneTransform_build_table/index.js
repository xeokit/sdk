// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

const OFFSET = 100000;

demoHelper
  .init()
  .then(() => {

    const {view, scene, data} = demoHelper;

    // Position the View camera so the demo model will be in frame.

    view.camera.eye = [OFFSET + 10, -2, 25];
    view.camera.look = [OFFSET + 0, -6, 0];
    view.camera.up = [0, 1, 0];

    // Create a SceneModel to hold geometry, meshes, and scene objects for rendering.

    const sceneModelResult = scene.createModel({
      id: "demoModel",
    });

    if (!sceneModelResult.ok) {
      throw new Error(sceneModelResult.error);
    }

    const sceneModel = sceneModelResult.value;

    // Create a reusable box geometry that will be instanced by the tabletop and each leg.

    const geometryResult = sceneModel.createGeometry({
      id: "demoBoxGeometry",
      primitive: xeokit.constants.TrianglesPrimitive,
      positions: [
        1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1,
        1, -1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1,
        -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1,
        -1, -1, -1, -1, -1, 1, -1, 1, 1, -1,
      ],
      indices: [
        0, 1, 2, 0, 2, 3,
        4, 5, 6, 4, 6, 7,
        8, 9, 10, 8, 10, 11,
        12, 13, 14, 12, 14, 15,
        16, 17, 18, 16, 18, 19,
        20, 21, 22, 20, 22, 23,
      ],
    });

    if (!geometryResult.ok) {
      throw new Error(geometryResult.error);
    }

    // create root transform

    const t1Result = sceneModel.createTransform({
      id: "rootTransform",
      matrix: xeokit.scene.buildMat4({
        position: [OFFSET + 0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      }),
    });

    if (!t1Result.ok) {
      throw new Error(t1Result.error);
    }

    const rootTransform = t1Result.value;

    // Create red leg transform

    const t2Result = sceneModel.createTransform({
      id: "redLegTransform",
      parentTransformId: "rootTransform",
      position: [-4, -6, -4],
      rotation: [0, 0, 0],
      scale: [1, 3, 1]
    });

    if (!t2Result.ok) {
      throw new Error(t2Result.error);
    }

    // Create a red mesh that instances the box geometry with the red leg transform.

    const m1Result = sceneModel.createMesh({
      id: "redLegMesh",
      geometryId: "demoBoxGeometry",
      parentTransformId: "redLegTransform",
      color: [1, 0, 0],
      opacity: 0.2
    });

    if (!m1Result.ok) {
      throw new Error(m1Result.error);
    }

    // Create green leg transform

    const t3Result = sceneModel.createTransform({
      id: "greenLegTransform",
      parentTransformId: "rootTransform",
      position: [4, -6, -4],
      rotation: [0, 0, 0],
      scale: [1, 3, 1]
    });

    if (!t3Result.ok) {
      throw new Error(t3Result.error);
    }

    // Create a green mesh that instances the box geometry with the green leg transform.

    const m2Result = sceneModel.createMesh({
      id: "greenLegMesh",
      geometryId: "demoBoxGeometry",
      parentTransformId: "greenLegTransform",
      color: [0, 1, 0]
    });

    if (!m2Result.ok) {
      throw new Error(m2Result.error);
    }

    // Create blue leg transform

    const t4Result = sceneModel.createTransform({
      id: "blueLegTransform",
      parentTransformId: "rootTransform",
      position: [4, -6, 4],
      rotation: [0, 0, 0],
      scale: [1, 3, 1]
    });

    if (!t4Result.ok) {
      throw new Error(t4Result.error);
    }

    const blueLegTransform = t4Result.value;

    // Create a blue mesh that instances the box geometry with the blue leg transform.

    const m3Result = sceneModel.createMesh({
      id: "blueLegMesh",
      geometryId: "demoBoxGeometry",
      parentTransformId: "blueLegTransform",
      color: [0, 0, 1]
    });

    if (!m3Result.ok) {
      throw new Error(m3Result.error);
    }

    // Create yellow leg transform

    const t5Result = sceneModel.createTransform({
      id: "yellowLegTransform",
      parentTransformId: "rootTransform",
      position: [-4, -6, 4],
      rotation: [0, 0, 0],
      scale: [1, 3, 1]
    });

    t5Result.value.rotation = [0, 40, 0];

    // t5Result.value.matrix = xeokit.scene.buildMat4({
    //   position: [-4, -6, 4],
    //   rotation: [0, 40, 0],
    //   scale: [1, 3, 1],
    // })

    if (!t5Result.ok) {
      throw new Error(t5Result.error);
    }

    // Create a yellow mesh that instances the box geometry with the yellow leg transform.

    const m4Result = sceneModel.createMesh({
      id: "yellowLegMesh",
      geometryId: "demoBoxGeometry",
      parentTransformId: "yellowLegTransform",
      color: [1, 1, 0]
    });

    if (!m4Result.ok) {
      throw new Error(m4Result.error);
    }

    const t6Result = sceneModel.createTransform({
      id: "tableTopTransform",
      parentTransformId: "rootTransform",
      position: [0, -3, 0],
      scale: [6, 0.5, 6]
    });

    if (!t6Result.ok) {
      throw new Error(t6Result.error);
    }

    // Create the tabletop mesh and scene object as a scaled instance of the same box geometry.

    const m5Result = sceneModel.createMesh({
      id: "purpleTableTopMesh",
      geometryId: "demoBoxGeometry",
      parentTransformId: "tableTopTransform",
      color: [1.0, 0.3, 1.0],
    });

    if (!m5Result.ok) {
      throw new Error(m5Result.error);
    }

    // sceneModel.createObject({
    //   id: "purpleTableTop",
    //   meshIds: ["purpleTableTopMesh"],
    // });

    // Signal that the demo is ready once all setup is complete.

    //view.objects["redLeg"].highlighted = true;

    demoHelper.finished();

    // new xeokit.core.SDKTask({
    //   name: "Animate Table",
    //   task: () => {
    //     rootTransform.rotation = [0, performance.now() / 40, performance.now() / 100];
    //     blueLegTransform.position = [4, (3 * Math.sin(performance.now() / 1000)) - 9, 4];
    //     blueLegTransform.rotation = [0, performance.now() / 100, 0];
    //   },
    //   stage: xeokit.core.SDKTask.AnimateStage,
    //   repeat: true
    // }).schedule();
  });
