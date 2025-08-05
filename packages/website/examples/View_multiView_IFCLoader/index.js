// Import xeokit SDK from a JS bundle built specially for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Ignore the DemoHelper

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold model geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold model semantic data

const data = new xeokit.data.Data();

// create a WebGLRenderer to use the browser's WebGL API for rendering

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that will use the WebGLRenderer to draw the Scene

const viewer = new xeokit.viewer.Viewer({
    id: "demoViewer",
    scene,
    renderer
});

const ifcLoader = new xeokit.ifc.IFCLoader();

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
    viewer,
    data
});

demoHelper.init()
    .then(() => {

        // Create the first View, with a perspective projection, looking at the model from the side

        const view1 = viewer.createView({
            id: "demoView1",
            elementId: "demoCanvas1"
        });

        view1.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view1.camera.eye = [-3.933, 2.855, 27.018];
        view1.camera.look = [4.400, 3.724, 8.899];
        view1.camera.up = [-0.018, 0.999, 0.039];
        view1.camera.zoom(2);
        view1.camera.orbitYaw(20);

        // Create the second View, with an orthographic projection, looking at the model from above

        const view2 = viewer.createView({
            id: "demoView2",
            elementId: "demoCanvas2"
        });

        view2.camera.projectionType = xeokit.constants.OrthoProjectionType;
        view2.camera.orthoProjection.scale = 20;
        view2.camera.orbitPitch(90);

        // Create the third View, with a perspective projection, looking at the model from the side

        const view3 = viewer.createView({
            id: "demoView3",
            elementId: "demoCanvas3"
        });

        view3.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view3.camera.zoom(2);
        view3.camera.orbitYaw(-50);
        view3.camera.orbitPitch(20);

        // Attach a CameraControls to each View, to control
        // its Camera independently with keyboard, mouse and touch input

        const cameraControl1 = new xeokit.cameracontrol.CameraControl(view1, {});
        const cameraControl2 = new xeokit.cameracontrol.CameraControl(view2, {});
        const cameraControl3 = new xeokit.cameracontrol.CameraControl(view3, {});

        // Create SceneModel to hold geometry

        const sceneModel = scene.createModel({
            id: "demoModel"
        });

        // Create DataModel to hold semantic data

        const dataModel = data.createModel({
            id: "demoModel"
        });

        if (sceneModel instanceof xeokit.core.SDKError) {
            console.error(`Error creating SceneModel: ${sceneModel.message}`);

        } else if (dataModel instanceof xeokit.core.SDKError) {
            console.error(`Error creating DataModel: ${dataModel.message}`);

        } else {

            // Instantiate the WebIFC API

            const ifcAPI = new WebIFC.IfcAPI();

            // Connect the WebIFC API to its WASM core module

            ifcAPI.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.51/");

            // Use IFCLoader to load an IFC 4x3 model into our SceneModel and DataModel

            fetch("../../models/IfcOpenHouse4/ifc/model.ifc").then(response => {

                response.arrayBuffer().then(fileData => {

                    ifcLoader.load({
                        fileData,
                        dataModel,
                        sceneModel
                    }).then(() => {


                        // The View will now contain a ViewObject for each SceneObject in the SceneModel.
                        // Via those ViewObjects, we can then control the appearance of each of our model objects in the View.

                        demoHelper.finished();

                    }).catch(error => {

                        dataModel.destroy();
                        sceneModel.destroy();

                        console.error(`Error parsing IFC file: ${error}`);
                    });
                });

            }).catch((e) => {
                console.log(`Error fetching IFC file: ${e}`);
                throw e;
            });
        }

        // viewer.onTick.subscribe(() => {
        //     view1.camera.orbitYaw(.5);
        //     view2.camera.orbitYaw(-1.3);
        // });

    });
