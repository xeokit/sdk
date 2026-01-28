import {log} from "../../js/logger.js";

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import * as WebIFC from "https://cdn.jsdelivr.net/npm/web-ifc@0.0.51/web-ifc-api.js";

const scene = new xeokit.scene.Scene();
const data = new xeokit.data.Data();

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

const viewer = new xeokit.viewer.Viewer({
    id: "demoViewer",
    scene,
    renderer
});

const view = viewer.createView({
    id: "demoView",
    elementId: "demoCanvas"
});

view.camera.orbitYaw(20);
view.camera.orbitPitch(20);

SceneEvents.onSceneModelCreated.subscribe(() => {
    cameraFlight.jumpTo({aabb: scene.aabb});
});

new xeokit.treeview.TreeView({
    containerElement: document.getElementById("treeViewContainer"),
    view,
    data,
    hierarchy: xeokit.treeview.TreeView.AggregationHierarchy,
    linkType: xeokit.ifctypes.IfcRelAggregates
});

const cameraControl = new xeokit.cameracontrol.CameraControl(view, {});

const ifcAPI = new WebIFC.IfcAPI();

ifcAPI.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.51/");

const sceneModel = scene.createModel({
    id: "demoModel"
});

const dataModel = data.createModel({
    id: "demoModel"
});

ifcAPI.Init().then(() => {

    fetch("../../data/models/IfcOpenHouse4/ifc/model.ifc").then(response => {

        response.arrayBuffer().then(fileData => {

            xeokit.webifc.loadWebIFC({
                ifcAPI,
                fileData,
                dataModel,
                sceneModel
            }).catch(error => {

                dataModel.destroy();
                sceneModel.destroy();

                console.log(error.message);
            });
        });

    }).catch((e) => {
        log(`Error building SceneModel: ${e}`);
        throw e;
    });
});
