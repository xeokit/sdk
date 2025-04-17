// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a GLTFLoader to load .glb files

const gltfLoader = new xeokit.gltf.GLTFLoader();

// Create a Scene to hold model geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold semantic information about the model

const data = new xeokit.data.Data();

// Create a WebGLRenderer to use the browser's WebGL API for rendering

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
    viewer,
    data
});

demoHelper.init()
    .then(() => {

        // Create a Viewer which uses the WebGLRenderer to render the Scene

        const viewer = new xeokit.viewer.Viewer({
            id: "demoViewer",
            scene,
            renderer
        });

        // Create the first View. This View has a perspective projection, looking at the center of the model along a diagonal axis.

        const view1 = viewer.createView({
            id: "demoView1",
            elementId: "demoCanvas1"
        });

        view1.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view1.camera.eye = [15, 0, 15];
        view1.camera.look = [0, 0, 0];
        view1.camera.up = [0, 1, 0];
        view1.camera.orbitPitch(20);

        // Replace the first View's light sources with our own AmbientLight and DirLight instances.

        view1.clearLights();

        new xeokit.viewer.AmbientLight(view1, {
            color: [1.0, 1.0, 1.0],
            intensity: 0.8
        });

        new xeokit.viewer.DirLight(view1, {
            dir: [-0.8, 1.0, -0.5],
            color: [0, 1, 0],
            intensity: 1.0,
            space: "world"
        });

        // Attach a CameraControl to the first View, to control the Camera with keyboard, mouse and touch input.

        new xeokit.cameracontrol.CameraControl(view1, {});

        // Create the second View. This View has a perspective projection, and is looking
        // at the denter of the model from along a diagonal axis.

        const view2 = viewer.createView({
            id: "demoView2",
            elementId: "demoCanvas2"
        });

        view2.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view2.camera.eye = [15, 0, 15];
        view2.camera.look = [0, 0, 0];
        view2.camera.up = [0, 1, 0];
        view2.camera.orbitPitch(20);

        // Add a CameraControl to the second View.

        new xeokit.cameracontrol.CameraControl(view2, {});

        // Replace the second View's light sources with our own AmbientLight and DirLight instances.

        view2.clearLights();

        new xeokit.viewer.AmbientLight(view2, {
            color: [1.0, 1.0, 1.0],
            intensity: 0.8
        });

        new xeokit.viewer.DirLight(view2, {
            dir: [-0.8, 1.0, -0.5],
            color: [0, 0, 1],
            intensity: 1.0,
            space: "world"
        });

        // Create the third View. This View has a perspective projection, and is also looking
        // at the denter of the model from along a diagonal axis.

        const view3 = viewer.createView({
            id: "demoView3",
            elementId: "demoCanvas3"
        });

        view3.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view3.camera.eye = [15, 0, 15];
        view3.camera.look = [0, 0, 0];
        view3.camera.up = [0, 1, 0];
        view3.camera.orbitPitch(20);

        // Add a CameraControl to the third View.

        new xeokit.cameracontrol.CameraControl(view3, {});

        // Replace the third View's light sources with our own AmbientLight and DirLight instances.

        view3.clearLights();

        new xeokit.viewer.AmbientLight(view3, {
            color: [1.0, 1.0, 1.0],
            intensity: 0.8
        });

        new xeokit.viewer.DirLight(view3, {
            dir: [-0.8, 1.0, -0.5],
            color: [1, 0, 0],
            intensity: 1.0,
            space: "world"
        });


        // Create a SceneModel and use GLTFLoader load a building model into it.

        const sceneModel = scene.createModel({
            id: "demoModel"
        });

        fetch("../../models/models/IfcOpenHouse2x3/ifc2gltf/model.glb").then(response => {
            response.arrayBuffer().then(fileData => {
                gltfLoader.load({fileData, sceneModel}).then(() => {

                    // Build the SceneModel.
                    // Each View will now contain its own ViewObject for each SceneObject in the SceneModel, illuminated
                    // by its own custom light sources. Via those ViewObjects, we can then control the appearance of
                    // each of our model objects independently in each View.

                    sceneModel.build();
                });
            });
        });
    });
