// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create an XKTLoader to load .xkt files

const xgfReader = new xeokit.xgf.XGFLoader();

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

view.camera.eye  = [-6.01, 9.11, -4.85];
view.camera.look = [3.93, -12.51, 2.65];
view.camera.up   = [0.12, -0.27, -0.95];

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

        // Load DataModelParams into the DataModel.

        fetch(`../../models/IfcOpenHouse4/dotbim2xgf/model.json`)
            .then(response => {
                response
                    .json()
                    .then(dataModelParams => {

                        dataModel.fromParams(dataModelParams);

                        // Use XGFLoader to load the XGF file into the SceneModel.


                        fetch(`../../models/IfcOpenHouse4/dotbim2xgf/model.xgf`)
                            .then(response => {
                                response
                                    .arrayBuffer()
                                    .then(fileData => {

                                        xgfReader.load({
                                            fileData,
                                            sceneModel

                                        }).then(() => { // XGF and JSON files loaded

                                            // The IFC model now appears in our Viewer.


                                            // Using the searchObjects function, query the Data for all the
                                            // IfcMember elements within a given IfcBuildingStorey.

                                            const resultObjectIds = [];

                                            const result = xeokit.data.searchObjects(data, {
                                                startObjectId: "38aOKO8_DDkBd1FHm_lVXz",
                                                includeObjects: [xeokit.ifctypes.IfcMember],
                                                includeRelated: [xeokit.ifctypes.IfcRelAggregates],
                                                resultObjectIds
                                            });

                                            // Check if the query was valid.

                                            if (typeof result === xeokit.core.SDKError) {
                                                console.error(result);
                                                return;
                                            }

                                            // If the query succeeded, go ahead and mark whatever
                                            // objects we found as selected. In this case, it will set the window
                                            // frames as selected in the View.

                                            view.setObjectsSelected(resultObjectIds, true);

                                            demoHelper.finished();

                                        }).catch(e => {
                                            console.error(e);
                                        });
                                    });
                            });
                    });
            });
    });

window.view = view;
