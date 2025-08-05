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

// Create a Viewer which uses the WebGLRenderer to render the Scene

const viewer = new xeokit.viewer.Viewer({
    id: "demoViewer",
    scene,
    renderer
});

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
    viewer
});

demoHelper.init()
    .then(() => {

// Create the first View. This View has a perspective projection, is looking at the model from the side, and is configured
// to not automatically create ViewLayers on-demand.

        const view1 = viewer.createView({
            id: "demoView1",
            elementId: "demoCanvas1",
            autoLayers: false // <<--------- Don't automatically create ViewLayers on-demand
        });

        view1.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view1.camera.eye = [-20, -5, 20];
        view1.camera.look = [0, -5, 0];
        view1.camera.up = [0, 1, 0];
        view1.camera.orbitPitch(20);

// Create two ViewLayers in the first View - "modelLayer" and "gridLayer"

        view1.createLayer({
            id: "modelLayer"
        });

        view1.createLayer({
            id: "gridLayer"
        });

// Create the second View. This View has an orthographc projection, is looking at the model along a diagonal axis,
// and like the previous View, is configured to not automatically create ViewLayers on-demand.

        const view2 = viewer.createView({
            id: "demoView2",
            elementId: "demoCanvas2",
            autoLayers: false
        });

        view2.camera.eye = [-20, -5, 20];
        view1.camera.look = [0, -5, 0];
        view1.camera.up = [0, 1, 0];

        view2.camera.projectionType = xeokit.constants.OrthoProjectionType;
        view2.camera.orthoProjection.scale = 30;
        view2.camera.orbitPitch(90);

// Create two ViewLayers in the second View - "modelLayer" and "gridLayer"

        view2.createLayer({
            id: "modelLayer"
        });

        view2.createLayer({
            id: "gridLayer"
        });

// Create the second View. This View has a perspective projection, is looking at the model along a diagonal axis,
// and like the previous two Views, is configured to not automatically create ViewLayers on-demand.

        const view3 = viewer.createView({
            id: "demoView3",
            elementId: "demoCanvas3",
            autoLayers: false
        });

        view3.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view3.camera.eye = [-20, -5, 20];
        view3.camera.look = [0, -5, 0];
        view3.camera.up = [0, 1, 0];
        view3.camera.orbitPitch(20);

// Create one ViewLayer in the third View - "modelLayer"

        view3.createLayer({
            id: "modelLayer"
        });

// Attach a CameraControl to each View, to control
// its Camera with mouse and touch input

        const cameraControl1 = new xeokit.cameracontrol.CameraControl(view1, {});
        const cameraControl2 = new xeokit.cameracontrol.CameraControl(view2, {});
        const cameraControl3 = new xeokit.cameracontrol.CameraControl(view3, {});

// Create a SceneModel and use GLTFLoader to load a house model into it.
// This SceneModel will appear in ViewLayer "modelLayer".
// Since that ViewLayer is in all three Views, the SceneModel will then
// appear in all three Views.

        const sceneModel = scene.createModel({
            id: "demoModel",
            layerId: "modelLayer"
        });

        fetch("../../data/models/IfcOpenHouse2x3/ifc2gltf/model.glb").then(response => {
            response.arrayBuffer().then(fileData => {
                gltfLoader.load({fileData, sceneModel}).then(() => {

                });
            });
        });

// Create another SceneModel and programmatically
// construct a wireframe ground plane grid.
//
// The SceneModel specifies that its SceneObject instances will
// belong to ViewLayer "gridLayer".
//
// The "gridLayer" ViewLayer is expected to already exist in our View, because we
// configured the View with autoLayers: false (true is the default).

        const gridSceneModel = scene.createModel({
            id: "demoHelperSceneModel",
            layerId: "gridLayer"
        });

        const grid = xeokit.procgen.buildGridGeometry({
            size: 100,
            divisions: 100
        });

        gridSceneModel.createGeometry({
            id: "gridGeometry",
            primitive: xeokit.constants.LinesPrimitive,
            positions: grid.positions,
            indices: grid.indices
        });

        gridSceneModel.createMesh({
            id: "gridMesh",
            geometryId: "gridGeometry",
            position: [0, -5, 0],
            color: [.7, .7, .7]
        });

        gridSceneModel.createObject({
            id: "grid",
            meshIds: ["gridMesh"]
        });

// Highlight the ViewObjects in ViewLayer "gridLayer"

        view.layers["gridLayer"].setObjectsHighlighted(["grid"], true);

        demoHelper.finished();

    });
