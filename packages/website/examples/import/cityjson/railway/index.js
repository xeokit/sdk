// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene, data, loader, and rendering APIs used by
// this example.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared rendering
// context and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  // Access the Scene and Data subsystems created by the Studio. The
  // Scene manages renderable content, while the Data subsystem manages
  // semantic model information.
  const { scene, data } = studio;

  // Create a CityJSONLoader to parse CityJSON data into renderable and
  // semantic model structures.
  const cityJSONLoader = new xeokit.formats.cityjson.CityJSONLoader();

  // Create a View with a camera configured in a +Z-up world coordinate
  // system. This is the default orientation, but it is shown here
  // explicitly for clarity.
  studio.viewManager.createView({
    id: "demoView",
    camera: {
      // projection: "perspective",
      eye: [11.50, 16.32, 15.12],
      look: [9.01, 9.65, 11.22],
      up: [-0.16, -0.45, 0.87]
    }
  });

  // Create a SceneModel to hold renderable model content. Geometry and
  // appearance data loaded from the CityJSON file will be stored here.
  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  // Stop if the SceneModel could not be created.
  if (!sceneModelResult.ok) {
    return;
  }

  const sceneModel = sceneModelResult.value;

  // Create a DataModel to hold semantic model information such as object
  // metadata and identity.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  // Stop if the DataModel could not be created.
  if (!dataModelResult.ok) {
    return;
  }

  const dataModel = dataModelResult.value;

  // Fetch the CityJSON file, parse it as JSON, and load it into both the
  // SceneModel and DataModel so that rendering and semantic information
  // remain linked.
  fetch("../../../../models/LoD3_Railway/cityjson/model.json").then(response => {

    response
        .json()
        .then(fileData => {

          cityJSONLoader.load({
            fileData,
            sceneModel,
            dataModel
          }).then(() => {

            // At this point, the SceneModel contains a SceneObject for each
            // renderable object in the model, while the DataModel contains
            // corresponding semantic objects. Each View also contains a
            // ViewObject for each SceneObject, allowing per-view appearance
            // control.
            studio.openInfoPanelFromMeta();
            studio.finished();

          }).catch(message => {
            console.error(`Error loading CityJSON: ${message}`);
          });
        });
  });
});