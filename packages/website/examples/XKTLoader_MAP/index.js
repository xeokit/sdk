// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create an XKTLoader to load .xkt files

const xktLoader = new xeokit.xkt.XKTLoader();

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

// Arrange the View's Camera within our +Z "up" coordinate system

view.camera.eye = [1841982.9384371885, 10.031355126263318, -5173286.744630201];
view.camera.look = [1842009.4968455553, 9.685518291306686, -5173295.851503017];
view.camera.up = [0.011650847910481935, 0.9999241456889114, -0.003995073374452514];

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

            // Use GLTFLoader to load a glTF model into our SceneModel and DataModel

            fetch("../../models/MAP/xkt/model.xkt").then(response => {

                response
                    .arrayBuffer()
                    .then(fileData => {

                        xktLoader.load({
                            fileData,
                            sceneModel
                        }).then(() => {


                            // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
                            // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
                            // will have a corresponding DataObject with the same ID, to attach semantic meaning.
                            // The View will contain a ViewObject corresponding to each SceneObject, through which the
                            // appearance of the object can be controlled in the View.

                            demoHelper.finished();
                        }).catch(message => {
                            console.error(`Error loading XKT: ${message}`);
                        });
                    });
            });
        }
    });

