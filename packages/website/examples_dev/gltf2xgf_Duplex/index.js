// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create an XGFLoader to load .xkt files

const xgfReader = new xeokit.xgf.XGFLoader();

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold semantic data

const data = new xeokit.data.Data();

// Create a Viewer that draws our Scene

const viewer = new xeokit.viewer.Viewer({
  scene
});

// Create a WebGLRenderer to render the Viewer.

const renderer = new xeokit.webglrenderer.WebGLRenderer({
  viewer
});

// Log any errors to the console.

const logError = (sdkResult) => {
  if (sdkResult.ok === false) {
    console.error(sdkResult.error);
  }
}

data.events.onError.subscribe(logError);
scene.events.onError.subscribe(logError);
viewer.events.onError.subscribe(logError);
renderer.events.onError.subscribe(logError);


// Ignore the DemoHelper

const demoHelper = new DemoHelper({
  viewer
});

demoHelper.init()
  .then(() => {



// Give the Viewer a single View to draw the Scene in our HTML canvas element

const viewResult = viewer.createView({
    id: "demoView",
    elementId: "demoCanvas"
});

if (!viewResult.ok) {
    return;
}

const view = viewResult.value;

// Configure the View's World-space coordinate axis to make the +Y axis "up"

view.camera.worldAxis = [
  1, 0, 0, // Right +X
  0, 1, 0, // Up +Z
  0, 0, 1  // Forward +Z
];

// Arrange the View's Camera

view.camera.eye = [14.915582703146043, 14.396781491179095, 5.431098754133695];
view.camera.look = [6.599999999999998, 8.34099990051474, -4.159999575600315];
view.camera.up = [-0.2820584034861215, 0.9025563895259413, -0.3253229483893775];

// Add a CameraControl to interactively control the View's Camera with keyboard,
// mouse and touch input

new xeokit.cameracontrol.CameraControl(view, {});

// Create a SceneModel to hold our model's geometry and materials

const sceneModelResult = scene.createModel({
    id: "demoModel"
});

if (!sceneModelResult.ok) {
    return;
}

const sceneModel = sceneModelResult.value;

        // Use XGFLoader to load the XGF file into the SceneModel.

        fetch(`../../models/Duplex/gltf2xgf/model.xgf`)
            .then(response => {
                response
                    .arrayBuffer()
                    .then(fileData => {

                        xgfReader.load({
                            fileData,
                            sceneModel

                        }).then(() => { // XGF and JSON files loaded

                            // The model now appears in our Viewer.

                            demoHelper.finished();

                        }).catch(e => {
                            console.error(e);
                        });
                    });
            });
    });
