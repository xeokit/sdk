// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

import {DemoHelper} from "../../js/DemoHelper.js";

const demoHelper = new DemoHelper({});

demoHelper.init().then(({
                          scene,
                          data,
                          viewer,
                          view,
                          renderer
                        }) => {

  const dotBIMLoader = new xeokit.formats.dotbim.DotBIMLoader();

        // Point the View's Camera at the center of the World coordinate system

        view.camera.eye = [-10, 20, 10];
        view.camera.look = [0, 0, 0];
        view.camera.up = [0, 0, 1];

        // Attach a CameraControl to the View

        new xeokit.cameracontrol.CameraControl(view);

        // Create a SceneModel to hold model geometry and materials

        const sceneModelResult = scene.createModel({
            id: "myModel"
        });

        if (!sceneModelResult.ok) {
            throw new Error("Unable to create SceneModel: " + sceneModelResult.error);
        }

        const sceneModel = sceneModelResult.value;

        // Create a DataModel to hold model semantic data

        const dataModelResult = data.createModel({
            id: "myModel"
        });

        if (!dataModelResult.ok) {
            throw new Error("Unable to create DataModel: " + dataModelResult.error);
        }

        const dataModel = dataModelResult.value;

        // Use DotBIMLoader to load a DotBIM model into the SceneModel and DataModel

        fetch("../../models/BlenderHouse/dotbim/model.bim")
          .then(response => {
            response.json().then(fileData => {

                dotBIMLoader.load({
                    fileData,
                    sceneModel,
                    dataModel
                }).then(() => {

                    // All done, model loaded.

                    demoHelper.finished();
                });
            });
        });
    });
