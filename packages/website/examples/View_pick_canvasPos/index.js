// Import xeokit SDK from a JS bundle built specially for these examples

import {log} from "../../js/logger.js";

import * as xeokit from "../../js/xeokit-demo-bundle.js?foo=";

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

// Give the Viewer a single View to render the Scene in our HTML canvas element

const view = viewer.createView({
    id: "demoView",
    elementId: "demoCanvas"
});

// Position the View's Camera

view.camera.eye = [10,20,15];
view.camera.look = [0, 0, 0];
view.camera.up = [0, 0, 1];


// Add a CameraControl to interactively control the View's Camera with keyboard,
// mouse and touch input

const cameraControl = new xeokit.cameracontrol.CameraControl(view, {});

// Within the Scene, create a SceneModel to hold geometry and materials for our model

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
    position: [-4, -4, 6],
    scale: [1, 1, 3]
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
    position: [4, -4, 6],
    scale: [1, 1, 3]
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
    position: [4, 4, 6],
    scale: [1, 1, 3]
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
    position: [-4, 4, 6],
    scale: [1, 1, 3]
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
    position: [0, 0, 9],
    scale: [6, 6, 0.5]
  }),
  color: [1.0, 0.3, 1.0]
});

sceneModel.createObject({
  id: "purpleTableTop",
  meshIds: ["purpleTableTopMesh"]
});

// Build the SceneModel. The View will now contain a ViewObject for each
// SceneObject in the SceneModel.

sceneModel.build().then(() => {

    // At this point, the View will contain five ViewObjects that have the same
    // IDs as our SceneObjects. Through these ViewObjects, we can update the
    // appearance of our model elements in that View.

    view.setObjectsSelected(["purpleTableTop"], true)
    view.objects["purpleTableTop"].edges = true;

}).catch((e) => {
    log(`Error building SceneModel: ${e}`);
    throw e;
});

// Finally, we'll bind a "mousemove" listener to the View's canvas. Whenever
// we get the event, we'll attempt to pick the closest ViewObject that lies
// at the event's mouse coordinates within the canvas. The returned PickResult
// will provide the results of each pick attempt.

let lastViewObject = null;

view.htmlElement.addEventListener("mousemove", (e) => {

    const canvasPos = getCanvasPosFromEvent(e, view.htmlElement, []);

    const pickResult = view.pick({
        pickViewObject: true,
        canvasPos
    });

    if (pickResult && pickResult.viewObject) {

        // If we succeed in picking a ViewObject, then get the ViewObject
        // from the PickResult and highlight it.

        if (!lastViewObject || pickResult.viewObject.id !== lastViewObject.id) {

            if (lastViewObject) {
                lastViewObject.highlighted = false;
            }

            lastViewObject = pickResult.viewObject;

            pickResult.viewObject.highlighted = true;
        }

    } else {

        if (lastViewObject) {
            lastViewObject.highlighted = false;
            lastViewObject = null;
        }
    }
});

function getCanvasPosFromEvent(event, htmlElement, canvasPos) {
    // if (!event) {
    //     event = window.event;
    canvasPos[0] = event.x;
    canvasPos[1] = event.y;
    // } else {
    //     const { left, top } = htmlElement.getBoundingClientRect();
    //     canvasPos[0] = event.clientX - left;
    //     canvasPos[1] = event.clientY - top;
    // }
    return canvasPos;
}
