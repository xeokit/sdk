import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

const scene = new xeokit.scene.Scene();
const data = new xeokit.data.Data();

const viewer = new xeokit.viewer.Viewer({
    id: "demoViewer",
    scene,
    renderer: new xeokit.webglrenderer.WebGLRenderer({})
});

const demoHelper = new DemoHelper({
    elementId: "info-container",
    viewer
});

demoHelper.init()
    .then(() => {

        viewer.onDestroyed.subscribe((viewer) => {
            demoHelper.log(`Viewer.onDestroyed( viewer.id="${viewer.id}" )`);
        });

        viewer.onViewCreated.subscribe((viewer, view) => {
            demoHelper.log(`Viewer.onViewCreated( viewer.id="${viewer.id}", view.id="${view.id}" )`);
        });

        viewer.onViewDestroyed.subscribe((viewer, view) => {
            demoHelper.log(`Viewer.onViewDestroyed( viewer.id="${viewer.id}", view.id="${view.id}" )`);
        });

        const view = viewer.createView({
            id: "demoView",
            elementId: "demoCanvas"
        });

        view.onDestroyed.subscribe((view) => {
            demoHelper.log(`View.onDestroyed( view.id="${view.id}" )`);
        });

        view.onBoundary.subscribe((view, boundary) => {
            demoHelper.log(`View.onBoundary( view.id="${view.id}", boundary=[${boundary}] )`);
        });

        view.onLayerCreated.subscribe((view, viewLayer) => {

            demoHelper.log(`ViewLayer.onLayerCreated( view.id="${view.id}", viewLayer.id="${viewLayer.id}" )`);

            viewLayer.onObjectCreated.subscribe((viewLayer, viewObject) => {
                demoHelper.log(`ViewLayer.onObjectCreated( viewLayer.id="${viewLayer.id}, viewObject.id="${viewObject.id}" )`);
            });

            viewLayer.onObjectDestroyed.subscribe((viewLayer, viewObject) => {
                demoHelper.log(`ViewLayer.onObjectDestroyed( viewLayer.id="${viewLayer.id}, viewObject.id="${viewObject.id}" )`);
            });

            viewLayer.onObjectVisibility.subscribe((viewLayer, viewObject) => {
                demoHelper.log(`ViewLayer.onObjectVisibility( viewLayer.id="${viewLayer.id}", viewObject.id="${viewObject.id}", visible=${viewObject.visible ? "true" : false}`);
            });

            // viewLayer.onObjectXRayed.subscribe((viewLayer, viewObject) => {
            //     demoHelper.log(`ViewObject ${viewObject.id} set xrayed = ${viewObject.xrayed ? "true" : "false"} in ViewLayer ${viewLayer.id}`);
            // });
        });

        view.onLayerDestroyed.subscribe((view, viewLayer) => {
            demoHelper.log(`View.onLayerDestroyed( view.id="${view.id}", viewLayer.id="${viewLayer.id}" )`);
        });

        view.onObjectCreated.subscribe((view, viewObject) => {
            demoHelper.log(`View.onObjectCreated( view.id="${view.id}", viewObject.id="${viewObject.id}" )`);
        });

        view.onObjectDestroyed.subscribe((view, viewObject) => {
            demoHelper.log(`View.onObjectDestroyed( view.id="${view.id}", viewObject.id="${viewObject.id}" )`);
        });

        view.onObjectVisibility.subscribe((view, viewObject) => {
            demoHelper.log(`View.onObjectVisibility( view.id="${view.id}", viewObject.id="${viewObject.id}", visible=${viewObject.visible ? "true" : false}`);
        });

        view.onObjectXRayed.subscribe((view, viewObject) => {
            demoHelper.log(`View.onObjectXRayed( view.id="${view.id}", viewObject.id="${viewObject.id}", xrayed=${viewObject.xrayed ? "true" : false}`);
        });

        const sceneModel = scene.createModel({
            id: "demoModel"
        });

        view.camera.eye = [0, 0, 10]; // Default
        view.camera.look = [0, 0, 0]; // Default
        view.camera.up = [0, 1, 0]; // Default

        // Add a CameraControl to interactively control the Camera with keyboard,
        // mouse and touch input

        new xeokit.cameracontrol.CameraControl(view);

        sceneModel.createGeometry({
            id: "triangleGeometry",
            primitive: xeokit.constants.TrianglesPrimitive,
            positions: [
                0.0, 1.5, 0.0,
                -1.5, -1.5, 0.0,
                1.5, -1.5, 0.0,
            ],
            indices: [
                0, 1, 2
            ]
        });

        sceneModel.createMesh({
            id: "triangleMesh",
            geometryId: "triangleGeometry",
            position: [0, 0, 0], // Default
            scale: [1, 1, 1], // Default
            rotation: [0, 0, 0], // Default
            color: [1, 1.0, 1.0] // Default
        });

        sceneModel.createObject({
            id: "triangleObject",
            meshIds: ["triangleMesh"]
        });

      // The model now appears in the View's canvas.

      demoHelper.finished();
    });
