// Import xeokit SDK via the JavaScript bundle that we've built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a GLTFLoader to load .glb files

const gltfLoader = new xeokit.gltf.GLTFLoader();

// Create a Scene to hold geometry and materials for our model

const scene = new xeokit.scene.Scene();

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that views our Scene using the WebGLRenderer. Note that the
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

        // Create a View, configured to automatically create ViewLayers on-demand, whenever they are
        // specified by a SceneModel's "viewLayer" configuration

        const view = viewer.createView({
            id: "demoView",
            elementId: "demoCanvas",
            autoLayers: true // <<------------- Default
        });

        // Set the View's Camera to look at a point five meters above the
        // center of the World coordinate system

        view.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
        view.camera.eye = [-20, -5, 20];
        view.camera.look = [0, -5, 0];
        view.camera.up = [0, 1, 0];
        view.camera.orbitPitch(20);

        // Attach a CameraControl to the View

        new xeokit.cameracontrol.CameraControl(view, {});

        // Create a SceneModel and use GLTFLoader load a building model into it.
        //
        // The SceneModel specifies that its SceneObject components will
        // belong to ViewLayer "modelLayer".
        //
        // The "modelLayer" ViewLayer is then created on-demand in our View, because we
        // configured the View with autoLayers: true (which is the default).

        const sceneModel = scene.createModel({
            id: "demoModel",
            layerId: "modelLayer"
        });

        fetch("../../models/IfcOpenHouse2x3/ifc2gltf/model.glb").then(response => {
            response.arrayBuffer().then(fileData => {
                gltfLoader.load({fileData, sceneModel}).then(() => {
                    sceneModel.build();
                });
            });
        });

        // Create another SceneModel and programmatically
        // construct a wireframe ground plane grid.
        //
        // The SceneModel specifies that its SceneObject instances will
        // belong to ViewLayer "gridLayer".
        //
        // The "gridLayer" ViewLayer is then created on-demand in our View, because we
        // configured the View with autoLayers: true (which is the default).

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

        gridSceneModel.build();

        // Highlight the ViewObjects in ViewLayer "gridLayer"

        view.layers["gridLayer"].setObjectsHighlighted(["grid"], true);

        demoHelper.finished();
    });
