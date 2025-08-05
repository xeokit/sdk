import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that views our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
  elementId: "info-container",
  viewer
});

demoHelper.init()
  .then(() => {

    // Give the Viewer a single View to render the Scene in our HTML canvas element

    const view = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    // Position the View's Camera

    view.camera.eye = [10, -2, 15];
    view.camera.look = [0, -6, 0];
    view.camera.up = [0, 1, 0];

    // Add a CameraControl to interactively control the Camera with keyboard,
    // mouse and touch input

    new xeokit.cameracontrol.CameraControl(view);

    // Within the Scene, create a SceneModel to hold geometry and materials for our model. We'll create
    // an empty SceneModel, then populate it with JSON that conforms to the schema defined by type SceneModelParams.

    const sceneModel = scene.createModel({
      id: "demoModel"
    });

    if (sceneModel instanceof xeokit.core.SDKError) {
      console.error(`Error creating SceneModel: ${sceneModel.message}`);
    } else {

      sceneModel.fromParams({ // SceneModelParams
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
            color: [1, 0.3, 0.3]
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

      // At this point, the View will contain five ViewObjects that have the same
      // IDs as our SceneObjects. Through these ViewObjects, we can update the
      // appearance of our model elements in that View. We'll make the yellow leg
      // translucent, highlight the red leg and make the tabletop green.

      view.objects["yellowLeg"].opacity = 0.5;
      view.objects["redLeg"].highlighted = true;
      view.objects["purpleTableTop"].colorize = [0, 1, 0];

      // We can also apply these sorts of updates in batches, to multiple
      // ViewObjects at a time. The View remembers the IDs of whetever
      // ViewObjects we update, so we can use such batch updates to restore the
      // ViewObjects to their original states.

      view.setObjectsOpacity(view.opacityObjectIds, 1.0);
      view.setObjectsHighlighted(view.highlightedObjectIds, false);
      view.setObjectsSelected(view.selectedObjectIds, false);

      demoHelper.finished();
    }
  });
