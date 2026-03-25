import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
  .init()
  .then(() => {

    const { scene} = demoHelper;

    demoHelper.createView({
      camera: {
        projection: "perspective",
        far: 1000000,
        eye: [10, -2, 15],
        look: [0, -6, 0],
        up: [0, 1, 0]
      }
    });

    // Within the Scene, create a SceneModel to hold geometry and materials for our model. We'll create
    // an empty SceneModel, then populate it with JSON that conforms to the schema defined by type SceneModelParams.

    const sceneModelResult = scene.createModel({
      id: "demoModel"
    });

    if (!sceneModelResult.ok) {
      return;
    }

    const sceneModel = sceneModelResult.value;

    const fromParamsResult = sceneModel.fromParams({ // SceneModelParams
      geometries: [
        {
          id: "demoBoxGeometry",
          primitive: xeokit.constants.TrianglesPrimitive,
          positions: [
            1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
            -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
            -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
          ],
          uvs: [
            1, 0, 0, 0, 0, 1, 1, 1,// v0-v1-v2-v3 front
            0, 0, 0, 1, 1, 1, 1, 0,// v0-v3-v4-v1 right
            1, 1, 1, 0, 0, 0, 0, 1,// v0-v1-v6-v1 top
            1, 0, 0, 0, 0, 1, 1, 1,// v1-v6-v7-v2 left
            0, 1, 1, 1, 1, 0, 0, 0,// v7-v4-v3-v2 bottom
            0, 1, 1, 1, 1, 0, 0, 0 // v4-v7-v6-v1 back
          ],
          indices: [
            0, 1, 2, 0, 2, 3,            // front
            4, 5, 6, 4, 6, 7,            // right
            8, 9, 10, 8, 10, 11,         // top
            12, 13, 14, 12, 14, 15,      // left
            16, 17, 18, 16, 18, 19,      // bottom
            20, 21, 22, 20, 22, 23
          ]
        }
      ],
      meshes: [
        {
          id: "redLeg-mesh",
          geometryId: "demoBoxGeometry",
          position: [-4, -6, -4],
          scale: [1, 3, 1],
          rotation: [0, 0, 0],
          color: [1, 0.3, 0.3],
        //  opacity: 0.5
        },
        {
          id: "greenLeg-mesh",
          geometryId: "demoBoxGeometry",
          position: [4, -6, -4],
          scale: [1, 3, 1],
          rotation: [0, 0, 0],
          color: [0.3, 1.0, 0.3]
        },
        {
          id: "blueLeg-mesh",
          geometryId: "demoBoxGeometry",
          position: [4, -6, 4],
          scale: [1, 3, 1],
          rotation: [0, 0, 0],
          color: [0.3, 0.3, 1.0]
        },
        {
          id: "yellowLeg-mesh",
          geometryId: "demoBoxGeometry",
          position: [-4, -6, 4],
          scale: [1, 3, 1],
          rotation: [0, 0, 0],
          color: [1.0, 1.0, 0.0]
        },
        {
          id: "tableTop-mesh",
          geometryId: "demoBoxGeometry",
          position: [0, -3, 0],
          scale: [6, 0.5, 6],
          rotation: [0, 0, 0],
          color: [1.0, 0.3, 1.0]
        }
      ],
      objects: [
        {
          id: "redLeg",
          meshIds: ["redLeg-mesh"]
        },
        {
          id: "greenLeg",
          meshIds: ["greenLeg-mesh"]
        },
        {
          id: "blueLeg",
          meshIds: ["blueLeg-mesh"]
        },
        {
          id: "yellowLeg",
          meshIds: ["yellowLeg-mesh"]
        },
        {
          id: "purpleTableTop",
          meshIds: ["tableTop-mesh"]
        }]
    });

    if (!fromParamsResult.ok) {
      throw new Error("Unable to populate SceneModel from params: " + fromParamsResult.error);
    }

    demoHelper.finished();
  });
