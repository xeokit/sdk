// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a LASLoader to load .BIM files

const lasLoader = new xeokit.las.LASLoader();

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

view.camera.eye=[-3.2316780510204524, 14.79759350180506, -40.64618522195356];
view.camera.look=[0.840821626591669, 0.5704883070260383, -26.168275027069072];
view.camera.up=[0.18608313688175518, 0.7264616310194785, 0.6615334948623277];

// It's often a good idea to set a large distance from the eye to the far clipping plane of
// the Camera's PerspectiveProjection, to ensure that we fit all the points in the view volume
// instead of weirdly cutting them off in the distance.

view.camera.perspectiveProjection.far = 10000000;

// Configure the View's PointsMaterial, which controls the appearance of our LAZ model

view.pointsMaterial.pointSize = 2;
view.pointsMaterial.roundPoints = false;
view.pointsMaterial.perspectivePoints = true;
view.pointsMaterial.minPerspectivePointSize = 2;
view.pointsMaterial.maxPerspectivePointSize = 4;
view.pointsMaterial.filterIntensity = true;
view.pointsMaterial.minIntensity = 0;
view.pointsMaterial.maxIntensity = 100;

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

            // Use LASLoader to load a LAZ model into our SceneModel and DataModel

            fetch("../../models/Nalls-Pumpkin-Hill/laz/model.laz").then(response => {

                response
                    .arrayBuffer()
                    .then(fileData => {

                    lasLoader.load({
                        fileData,
                        sceneModel,
                        dataModel
                    }).then(() => {


                        // The Scene and SceneModel will now contain a SceneObject to represent the LAS/LAZ point cloud,
                      // and the Data and DataModel will contain a corresponding DataObject.

                        demoHelper.finished();

                    }).catch(message => {
                        console.error(`Error loading LAS: ${message}`);
                    });
                });
            });
        }
    });

