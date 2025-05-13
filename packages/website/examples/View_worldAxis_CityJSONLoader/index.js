// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create an CityJSONLoader to load CityJSON files

const cityJSONReader = new xeokit.cityjson.CityJSONLoader();

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold semantic data

const data = new xeokit.data.Data();

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that draws our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
    id: "demoViewer",
    scene,
    renderer
});

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

        // Configure the View's World-space coordinate axis to make the +Z axis "up"

        view.camera.worldAxis = [
            1, 0, 0, // Right +X
            0, 0, 1, // Up +Z
            0, -1, 0  // Forward -Y
        ];

        // Arrange the View's Camera within our +Z "up" coordinate system

        view.camera.eye = [15, 10, 0];
        view.camera.look = [0, 0, 0];
        view.camera.up = [0, 0, 1];

        view.camera.orbitPitch(20);

        // Add a CameraControl to interactively control the Camera with keyboard,
        // mouse and touch input

        new xeokit.cameracontrol.CameraControl(view);

        // Configure our View to automatically reposition its Camera
        // to view the entire Scene whenever a new SceneModel is created. We'll
        // use a CameraFlightAnimation to reposition the Camera.

        const cameraFlight = new xeokit.cameraflight.CameraFlightAnimation(view);

        scene.onModelCreated.subscribe(() => {
            cameraFlight.jumpTo({aabb: scene.aabb});
            console.log(sceneModel.getJSON())
        });

        // Create a SceneModel to hold model geometry and materials

        const sceneModel = scene.createModel({
            id: "demoModel"
        });

        // Create a DataModel to hold IFC data for our model

        const dataModel = data.createModel({
            id: "demoModel"
        });

        // Use CityJSONLoader to load a CityJSON into our SceneModel and DataModel

        fetch("../../models/LoD3_Railway/cityjson/model.json")
            .then(response => {
                response
                    .json()
                    .then(fileData => {

                        cityJSONReader.load({
                            fileData,
                            sceneModel,
                            dataModel
                        })
                            .then(() => {

                                // Build the SceneModel. The View will now contain a ViewObject for each
                                // SceneObject in the SceneModel.

                                sceneModel.build();
                                dataModel.build();

                                demoHelper.finished();
                            })
                            .catch((err) => {
                                console.error(err);
                            });
                    }).catch((err) => {
                    console.error(err);
                });
            }).catch((err) => {
            console.error(err);
        });
    });
