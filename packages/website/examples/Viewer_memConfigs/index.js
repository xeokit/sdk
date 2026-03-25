// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
  .init()
  .then(() => {

    const { scene, data} = demoHelper;

    const dotBIMLoader = new xeokit.formats.dotbim.DotBIMLoader();

    // Point the View's Camera at the center of the World coordinate system

    demoHelper.createView({
      camera: {
        "eye": [-8.130013786316548,21.480352408354243,8.619051667183644],
        "look": [2.6191908493035694,5.746608740751704,5.027820082634694],
        "up": [0.10447660354067913,-0.15292369873852732,0.9826998431244058]
      }
    });

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
