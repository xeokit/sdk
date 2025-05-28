// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

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

// Ignore the DemoHelper

const demoHelper = new DemoHelper({
    viewer
});

demoHelper.init().then(() => {

    // Create a single View that renders to a canvas in the page

    const view = viewer.createView({
        id: "demoView",
        elementId: "demoCanvas"
    });

    // Position the View's Camera to look at the origin of the coordinate system

    view.camera.eye = [2, 3, 2];
    view.camera.look = [0, 0, 0];
    view.camera.up = [0, 0, 1];

    // Add a CameraControl to the View to control its Camera with mouse and touchpad input

    new xeokit.cameracontrol.CameraControl(view);

    // Within the Scene, create a SceneModel to hold geometry and materials for our model

    const sceneModel = scene.createModel({
        id: "demoModel"
    });

    // Create a SceneGeometry that defines the shape of the box

    sceneModel.createGeometry({
        id: "boxGeometry",
        primitive: xeokit.constants.TrianglesPrimitive,

        // Define the SceneGeometry vertices - eight for our box, each
        // one spanning three array elements for X,Y and Z

        positions: [

            1.0, 1.0, 1.0, // v0-v1-v2-v3 front
            -1.0, 1.0, 1.0,
            -1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,

            1.0, 1.0, 1.0, // v0-v3-v4-v1 right
            1.0, -1.0, 1.0,
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,

            1.0, 1.0, 1.0, // v0-v1-v6-v1 top
            1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0,

            -1.0, 1.0, 1.0,  // v1-v6-v7-v2 left
            -1.0, 1.0, -1.0,
            -1.0, -1.0, -1.0,
            -1.0, -1.0, 1.0,

            -1.0, -1.0, -1.0, // v7-v4-v3-v2 bottom
            1.0, -1.0, -1.0,
            1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,

            1.0, -1.0, -1.0,  // v4-v7-v6-v1 back
            -1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0,
            1.0, 1.0, -1.0
        ],

        // Define the SceneGeometry indices - these organise the
        // positions coordinates
        // into geometric primitives in accordance
        // with the TrianglesPrimitive parameter,
        // in this case a set of three indices
        // for each triangle. Note that each triangle is specified
        // in counter-clockwise winding order.

        indices: [

            0, 1, 2,   // Front
            0, 2, 3,

            4, 5, 6,  // Right
            4, 6, 7,

            8, 9, 10, // Top
            8, 10, 11,

            12, 13, 14,   // Left
            12, 14, 15,

            16, 17, 18,  // Bottom
            16, 18, 19,

            20, 21, 22,// Back
            20, 22, 23
        ]
    });

    // Create a red SceneMesh that instances our SceneGeometry

    sceneModel.createMesh({
        id: "boxMesh",
        geometryId: "boxGeometry",
        position: [0, 0, 0], // Default
        scale: [1, 1, 1], // Default
        rotation: [0, 0, 0], // Default
        color: [1.0, 0.0, 0.0] // Default is [1,1,1]
    });

    // Create a SceneObject that aggregates our SceneMesh

    sceneModel.createObject({
        id: "boxObject",
        meshIds: ["boxMesh"]
    });

    // Build the SceneModel, causing the red box to appear in the View's canvas.

    sceneModel.build().then(() => {

        // At this point, the View will contain a single ViewObject that has the same
        // ID as the SceneObject. Through the ViewObject, we can now update the
        // appearance of the box in that View.

        view.objects["boxObject"].highlighted = true;
        view.setObjectsHighlighted(view.highlightedObjectIds, false);

        // Ignore the DemoHelper

        demoHelper.finished();

    }).catch(reason => {
        console.error(reason);
        demoHelper.finished();
    });
});
