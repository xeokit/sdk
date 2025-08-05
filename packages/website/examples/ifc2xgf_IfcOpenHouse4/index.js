// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create an XKTLoader to load .xkt files

const xgfLoader = new xeokit.xgf.XGFLoader();

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold semantic data

const data = new xeokit.data.Data();

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
    viewer,
    data
});

demoHelper.init()
    .then(() => {

        // Create a DataModel to hold semantic data for our model

        const dataModel = data.createModel({
            id: "demoModel"
        });

        if (sceneModel instanceof xeokit.core.SDKError) {
            console.error(`Error creating SceneModel: ${sceneModel.message}`);

        } else {

            // Use XGFLoader to load a glTF model into our SceneModel and DataModel

            fetch("../../models/IfcOpenHouse4/ifc2xgf/model.xgf").then(response => {

                response
                    .arrayBuffer()
                    .then(fileData => {

                    xgfLoader.load({
                        fileData,
                        sceneModel,
                        dataModel
                    }).then(() => {


                        // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
                        // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
                        // will have a corresponding DataObject with the same ID, to attach semantic meaning.
                        // The View will contain a ViewObject corresponding to each SceneObject, through which the
                        // appearance of the object can be controlled in the View.

                        demoHelper.finished();

                    }).catch(message => {
                        console.error(`Error loading XGF: ${message}`);
                    });
                });
            });
        }
    });

