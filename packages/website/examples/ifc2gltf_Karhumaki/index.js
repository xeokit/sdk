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

        // Fetch the Ifc2gltfManifestParams for the model. This file was output by ifc2gltf.

        fetch(`../../models/KarhumakiBridge/ifc2gltf/model.manifest.json`)
            .then(response => {
                response
                    .json()
                    .then(ifc2gltfManifest => {

                        // Use convertIfc2gltfManifest to convert the Ifc2gltfManifestParams into a ModelChunksManifestParams

                        const modelChunksManifest = xeokit.ifc2gltf2xgf.convertIfc2gltfManifest(ifc2gltfManifest);

                        // Create a ModelChunksLoader, equipped with a GLTFLoader and MetaModelLoader.

                        const modelChunksLoader = new xeokit.modelchunksloader.ModelChunksLoader({
                            sceneModelLoader: new xeokit.gltf.GLTFLoader(),
                            dataModelLoader: new xeokit.metamodel.MetaModelReader()
                        });

                        // Use the ModelChunksLoader to load the glTF
                        // and JSON files listed in the ModelChunksManifestParams.  The ModelChunksLoader will use GLTFLoader to
                        // load each glTF file into the SceneModel, and loadMetaModel to load each JSON MetaModelParams
                        // file into the DataModel.

                        modelChunksLoader.load({
                            modelChunksManifest,
                            baseDir: "../../models/KarhumakiBridge/ifc2gltf/",
                            sceneModel,
                            dataModel

                        }).then(() => { // glTF and JSON files loaded


                            // The Karhumaki Bridge model now appears in our Viewer.

                            demoHelper.finished();

                        }).catch(e=>{
                            console.error(e);
                        });
                    });
            });
    });

