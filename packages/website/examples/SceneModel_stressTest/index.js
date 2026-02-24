// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
  .init()
  .then(() => {

    const {view, scene} = demoHelper;

    // Position the View's Camera.

    const OFFSET = 250;

    view.camera.eye = [OFFSET, -450, 300];
    view.camera.look = [OFFSET, 0, 0];
    view.camera.up = [0, 0, 1];

    view.camera.perspectiveProjection.far = 100000;

    // Within the Scene, create a SceneModel to hold geometry and materials for our model

    const sceneModelRes = scene.createModel({
      id: "demoModel"
    });

    // Create a box-shaped SceneGeometry, which we'll reuse for the tabletop and legs.

    const sceneModel = sceneModelRes.value;

    // const geometryResult = sceneModel.createGeometry({
    //   id: "demoBoxGeometry",
    //   primitive: xeokit.constants.TrianglesPrimitive,
    //   positions: [
    //     1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
    //     -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
    //     -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
    //   ],
    //   indices: [
    //     0, 1, 2, 0, 2, 3,            // front
    //     4, 5, 6, 4, 6, 7,            // right
    //     8, 9, 10, 8, 10, 11,         // top
    //     12, 13, 14, 12, 14, 15,      // left
    //     16, 17, 18, 16, 18, 19,      // bottom
    //     20, 21, 22, 20, 22, 23
    //   ]
    // });
    //
    // if (!geometryResult.ok) {
    //   console.error(geometryResult.error);
    //   return;
    // }

    let i = 0;
    const dequeue = [];

    function createObject() {

      sceneModel.createGeometry({
        id: "demoBoxGeometry" + i,
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
      const meshResult = sceneModel.createMesh({
        id: "redLegMesh" + i,
        geometryId: "demoBoxGeometry" + i,
        matrix: xeokit.scene.buildMat4({
          position: [OFFSET + Math.random() * 200 - 100, Math.random() * 200 - 100, Math.random() * 200 - 100],
          scale: [2, 2, 2],
          //rotation: [Math.random() * 360, Math.random() * 360, Math.random() * 360]
        }),
        color: [Math.random(), Math.random(), Math.random()]
      });

      if (!meshResult.ok) {
        console.error(meshResult.error);
        return;
      }

      const objectRes = sceneModel.createObject({
        id: "redLeg" + i,
        meshIds: ["redLegMesh" + i]
      });

      if (!objectRes.ok) {
        console.error(objectRes.error);
        return;
      }

      dequeue.push(objectRes.value);

      if (dequeue.length > 5000) {
        const oldObject = dequeue.shift();
        oldObject.destroy();
        oldObject.meshes.forEach((mesh) => {
          mesh.destroy();
        });

      }

      i++;
    }

    setInterval(() => {
      for (let j = 0; j < 50; j++)
        createObject();

// TODO: Auto scheduler
      view.camera.orbitYaw(.2);
      view.camera.orbitPitch(.1);

    }, 10);

    demoHelper.finished();
  });
