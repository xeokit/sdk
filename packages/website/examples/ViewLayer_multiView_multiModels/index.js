// Import xeokit SDK from the JavaScript bundle that we've built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper";

// Create a GLTFLoader to load .glb files

const gltfLoader = new xeokit.gltf.GLTFLoader();

// Create a Viewer with a Scene and a WebGLRenderer

const scene = new xeokit.scene.Scene();

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

const viewer = new xeokit.viewer.Viewer({
    id: "demoViewer",
    scene,
    renderer
});

// Ignore this DemoHelper

const demoHelper = new DemoHelper({
    elementId: "info-container",
    viewer,
    data
});

demoHelper.init()
    .then(() => {

        // Create the first View, with a perspective Camera projection, looking at the model from the side.
        // Configure the View to not automatically create ViewLayers on-demand.

        const view1 = viewer.createView({
            id: "demoView1",
            elementId: "demoCanvas1",
            autoLayers: false
        });

        view1.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view1.camera.eye = [1841982.9384371885, 10.031355126263318, -5173286.744630201];
        view1.camera.look = [1842009.4968455553, 9.685518291306686, -5173295.851503017];
        view1.camera.up = [0.011650847910481935, 0.9999241456889114, -0.003995073374452514];
        view1.camera.orbitPitch(20);

        // Add a CameraControl to the first View, to control its Camera with keyboard, mouse and touch input.

        new xeokit.cameracontrol.CameraControl(view1, {});

        // Create a ViewLayer in the first View - "viewLayer1".

        view1.createLayer({
            id: "viewLayer1"
        });

        // Create the second View, with an orthographic Camera projecton, looking at the model from above.
        // Configure the View to not automatically create ViewLayers on-demand.

        const view2 = viewer.createView({
            id: "demoView2",
            elementId: "demoCanvas2",
            autoLayers: false
        });

        view2.camera.eye = [1841982.9384371885, 10.031355126263318, -5173286.744630201];
        view2.camera.look = [1842009.4968455553, 9.685518291306686, -5173295.851503017];
        view2.camera.up = [0.011650847910481935, 0.9999241456889114, -0.003995073374452514];
        view2.camera.projectionType = xeokit.constants.OrthoProjectionType;
        view2.camera.orthoProjection.scale = 40;

        // Add a CameraControl to the second View.

        new xeokit.cameracontrol.CameraControl(view2, {});

        // Create a ViewLayer in the second View - "viewLayer1" - same ID as the ViewLayer in the first View.

        view2.createLayer({
            id: "viewLayer1"
        });

        // Create the third View, with a perspective Camera projecton, looking at the model on an angle.
        // Configure the View to not automatically create ViewLayers on-demand.

        const view3 = viewer.createView({
            id: "demoView3",
            elementId: "demoCanvas3",
            autoLayers: false
        });

        view3.camera.eye = [1394.38, 3.78, -247.05];
        view3.camera.look = [1391.46, 0.89, -244.24];
        view3.camera.up = [-0.41, 0.81, 0.40];
        view3.camera.zoom(-20)

        // Add a CameraControl to the third View.

        new xeokit.cameracontrol.CameraControl(view3, {});

        // Create a ViewLayer in the second View - "viewLayer1" - same ID as the ViewLayer in the first and second Views.

        view3.createLayer({
            id: "viewLayer2"
        });

        // Create a SceneModel and use XKTLoader load a building model into it.

        fetch("../../models/models/IfcOpenHouse2x3/ifc2gltf/model.glb").then(response => {
            response.arrayBuffer().then(fileData => {
                const sceneModel = scene.createModel({
                    id: "demoModel1"
                });
                xeokit.gltf.GLTFLoader({fileData, sceneModel}).then(() => {
                    sceneModel.build();
                });
            });
        });

        // Create a SceneModel containing a simple house model. This SceneModel will appear in ViewLayer "viewLayer1".

        fetch("../../models/MAP/ifc2gltf2xgf/model.xgf").then(response => {
            response.arrayBuffer().then(fileData => {
                const sceneModel = scene.createModel({
                    id: "demoModel2",
                    layerId: "viewLayer1"
                });
                xeokit.xgf.XGFLoader.load({
                    fileData,
                    sceneModel
                }).then(() => {
                    sceneModel.build();
                })
            });
        });

        // Create another SceneModel, containing a different house model. This SceneModel will appear in ViewLayer "viewLayer2".

        fetch("../../models/HousePlan/gltf/model.glb").then(response => {
            response.arrayBuffer().then(fileData => {
                const sceneModel = scene.createModel({
                    id: "demoModel3",
                    layerId: "viewLayer2"
                });
                gltfLoader.load({
                    fileData,
                    sceneModel
                }).then(() => {
                    sceneModel.build();
                });
            });
        });
    });
