// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";


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

view.camera.eye=[-31.63254701136148, 63.84407843065014, -97.64896735426231];
view.camera.look=[-69.51194533142663, 31.241318427077932, -62.52887630516256];
view.camera.up=[-0.3913972432760181, 0.8456487936816226, 0.3628860919086728];

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

        // Fetch the ModelChunksManifestParams for the model. This file was output by ifc2gltf2xgf.

        fetch(`../../models/KarhumakiBridge/ifc2gltf2xgf/model.manifest.json`)
            .then(response => {
                response
                    .json()
                    .then(modelChunksManifest => {

                        // Create a ModelChunksLoader, equipped with an XGFLoader and a DataModelParamsLoader.

                        const modelChunksLoader = new xeokit.modelchunksloader.ModelChunksLoader({
                            sceneModelLoader: new xeokit.xkt.XGFLoader(),
                            dataModelLoader: new xeokit.data.DataModelReader()
                        });

                        // Use the ModelChunksLoader to load the glTF
                        // and JSON files listed in the ModelChunksManifestParams. The ModelChunksLoader will use XGFLoader to
                        // load each XGF file into the SceneModel, and DataModelParamsLoader to load each JSON DataModelParams
                        // file into the DataModel.

                        modelChunksLoader.load({
                            modelChunksManifest,
                            baseDir: "../../models/KarhumakiBridge/ifc2gltf2xgf/",
                            sceneModel,
                            dataModel

                        }).then(() => { // XGF and JSON files loaded

                            // Build the SceneModel and DataModel.
                            // The Karhumaki Bridge model now appears in our Viewer.

                            sceneModel.build();
                            dataModel.build();

                            demoHelper.finished();

                        }).catch(e=>{
                            console.error(e);
                        });
                    });
            });
    });

