// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a CityJSONLoader to load CityJSON files

const cityJSONLoader = new xeokit.cityjson.CityJSONLoader();

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

// Configure the View's World-space coordinate axis to make the +Z axis "up"

view.camera.worldAxis = [
    1, 0, 0, // Right +X
    0, 0, 1, // Up +Z
    0, -1, 0  // Forward -Y
];

// Arrange the View's Camera within our +Z "up" coordinate system

view.camera.eye = [11.50, 16.32, 15.12];
view.camera.look = [9.01, 9.65, 11.22];
view.camera.up = [-0.16, -0.45, 0.87];

view.camera.zoom(-15)

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

            // Use CityJSONLoader to load an IFC model from a dotbim file into our SceneModel and DataModel

            fetch("../../models/LoD3_Railway/cityjson/model.json").then(response => {

                response
                    .json()
                    .then(fileData => {

                        cityJSONLoader.load({
                            fileData,
                            sceneModel,
                            dataModel
                        }).then(() => {

                            // Build the SceneModel and DataModel.
                            // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
                            // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
                            // will have a corresponding DataObject with the same ID, to attach semantic meaning.
                            // The View will contain a ViewObject corresponding to each SceneObject, through which the
                            // appearance of the object can be controlled in the View.

                            dataModel.build();
                            sceneModel.build();

                            demoHelper.finished();
                        }).catch(message => {
                            console.error(`Error loading CityJSON: ${message}`);
                        });;
                    });
            });
        }
    });
