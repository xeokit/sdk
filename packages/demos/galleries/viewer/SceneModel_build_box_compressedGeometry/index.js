import * as xeokit from "./../../../js/xeokit-demo-bundle.js";

const scene = new xeokit.scene.Scene();

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

const viewer = new xeokit.viewer.Viewer({
    id: "myViewer",
    scene,
    renderer
});

const view = viewer.createView({
    id: "myView",
    elementId: "myCanvas"
});

view.camera.eye = [3, 3, 3]; // Default is [0,0,10]
view.camera.look = [0, 0, 0]; // Default
view.camera.up = [0, 1, 0]; // Default

new xeokit.cameracontrol.CameraControl(view);

const sceneModel = scene.createModel({
    id: "myModel"
});

sceneModel.createGeometryCompressed({
    id: "boxGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,
    aabb: [-1, -1, -1, 1, 1, 1],
    positionsCompressed: [
        65525, 65525, 65525, 0, 65525, 65525, 0, 0, 65525, 65525, 0,
        65525, 65525, 65525, 65525, 65525, 0, 65525, 65525, 0, 0,
        65525, 65525, 0, 65525, 65525, 65525, 65525, 65525, 0, 0,
        65525, 0, 0, 65525, 65525, 0, 65525, 65525, 0, 65525, 0,
        0, 0, 0, 0, 0, 65525, 0, 0, 0, 65525, 0, 0, 65525, 0, 65525,
        0, 0, 65525, 65525, 0, 0, 0, 0, 0, 0, 65525, 0, 65525, 65525, 0
    ],
    indices: [
        0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13,
        14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
    ],
    edgeIndices: [
        8, 12, 12, 19, 19, 18, 8, 18, 18, 20, 20, 23,
        8, 23, 23, 22, 12, 22, 22, 21, 19, 21, 20, 21
    ]
});

sceneModel.createMesh({
    id: "boxMesh",
    geometryId: "boxGeometry",
    position: [0, 0, 0], // Default
    scale: [1, 1, 1], // Default
    rotation: [0, 0, 0], // Default
    color: [1, 1.0, 1.0] // Default
});

sceneModel.createObject({
    id: "boxObject",
    meshIds: ["boxMesh"]
});

sceneModel.build();
