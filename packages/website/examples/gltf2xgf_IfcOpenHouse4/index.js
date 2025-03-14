// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a WebGLRenderer to use the browser's WebGL graphics API for rendering

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that will use the WebGLRenderer to draw the Scene

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

// Arrange the View's Camera

view.camera.eye = [-6.01, 4.85, 9.11];
view.camera.look = [3.93, -2.65, -12.51];
view.camera.up = [0.12, 0.95, -0.27];

// Add a CameraControl to interactively control the View's Camera with keyboard,
// mouse and touch input

new xeokit.cameracontrol.CameraControl(view, {});

// Create a SceneModel to hold our model's geometry and materials

const sceneModel = scene.createModel({
    id: "demoModel"
});

// Ignore the DemHelper

const demoHelper = new DemoHelper({
    viewer
});

demoHelper.init()
    .then(() => {

        // Use loadXGF to load the XGF file into the SceneModel.

        fetch(`../../models/IfcOpenHouse4/gltf2xgf/model.xgf`)
            .then(response => {
                response
                    .arrayBuffer()
                    .then(fileData => {

                        xeokit.xgf.loadXGF({
                            fileData,
                            sceneModel

                        }).then(() => { // XGF and JSON files loaded

                            // Build the SceneModel.
                            // The model now appears in our Viewer.

                            sceneModel.build();

                            demoHelper.finished();

                        }).catch(e => {
                            console.error(e);
                        });
                    });
            });
    });
