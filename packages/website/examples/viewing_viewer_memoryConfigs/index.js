// Import the xeokit SDK bundle used by these examples.
// It includes format loaders and demo helper utilities.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper.
// It initializes the scene, data, viewer, and renderer context used in this demo.

const studio = new xeokit.studio.Studio({});

studio
  .init()
  .then(() => {

    const { scene, data} = studio;

    const dotBIMLoader = new xeokit.formats.dotbim.DotBIMLoader();

    // Create a view and set an initial camera.
    // The camera framing is chosen to show the model clearly after loading.

    studio.viewManager.createView({
      camera: {
        "eye": [-8.130013786316548,21.480352408354243,8.619051667183644],
        "look": [2.6191908493035694,5.746608740751704,5.027820082634694],
        "up": [0.10447660354067913,-0.15292369873852732,0.9826998431244058]
      }
    });

    // Create a SceneModel for renderable geometry and material data.
    // This is where the loaded DotBIM geometry will be stored.

    const sceneModelResult = scene.createModel({
      id: "myModel"
    });

    if (!sceneModelResult.ok) {
      throw new Error("Unable to create SceneModel: " + sceneModelResult.error);
    }

    const sceneModel = sceneModelResult.value;

    // Create a DataModel for semantic object data.
    // Metadata and relationships are loaded here.

    const dataModelResult = data.createModel({
      id: "myModel"
    });

    if (!dataModelResult.ok) {
      throw new Error("Unable to create DataModel: " + dataModelResult.error);
    }

    const dataModel = dataModelResult.value;

    // Fetch and load the DotBIM file.
    // The loader populates both SceneModel and DataModel for linked graphics and metadata.

    fetch("../../models/BlenderHouse/dotbim/model.bim")
      .then(response => {
        response.json().then(fileData => {

          dotBIMLoader.load({
            fileData,
            sceneModel,
            dataModel
          }).then(() => {

            // Mark the demo as finished once loading succeeds.
            // At this point the model is ready for interaction.

            studio.finished();
          });
        });
      });
  });
