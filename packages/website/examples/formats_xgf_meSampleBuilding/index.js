// Import the xeokit SDK bundle used by this example.
// It provides the helper, loader, and rendering APIs used in this sample.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene, data} = studio;

  // Create a XGFLoader to load .XGF files

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Create a view and set the initial camera.
  // The camera is aimed at the world origin to frame the model consistently.

  const view = studio.viewManager.createView({
    id: "demoView",
    camera: {
     eye: [  67.74194658396226, -4.121982515645583, 20.110348414033115],
      look: [ 26.98026216623765, 26.288490354227463, 4.19249791964835],
      up: [  -0.23942012120238962, 0.17862066842709445, 0.9543441006126097]
    }
  });

  view.camera.worldAxis = [
    1, 0, 0, // Right +X
    0, 0, 1, // Up +Z
    0, -1, 0  // Forward -Y
  ];
  // Create a SceneModel for renderable model content.
  // Geometry and material data loaded from files is stored here.
  const sceneModelRes = scene.createModel({
    id: "demoModel",
    coordinateSystem: { // Model's local Y-up coordinate system
      basis: [
        1, 0, 0, // Right +X
        0, 1, 0, // Up +Y
        0, 0, -1  // Forward -Z
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  if (sceneModelRes.ok === false) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;
  // Create a DataModel for semantic model data.
  // Metadata, relationships, and object meaning are stored here.
  const dataModelRes = data.createModel({
    id: "demoModel"
  });


  if (dataModelRes.ok === false) {
    console.error(`Error creating DataModel: ${dataModelRes.error}`);

  } else {

    const dataModel = dataModelRes.value;
  // Fetch and load the XGF file into the SceneModel.
  // After loading, the view can switch to its final quality settings.
    fetch("../../models/ME-Demo_Sample_Single_Building_01/ifc2xgf/model.xgf").then(response => {

      response
        .arrayBuffer()
        .then(fileData => {

          xgfLoader.load({
            fileData,
            sceneModel,
            dataModel
          }).then(() => {


            // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
              // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
              // will have a corresponding DataObject with the same ID, to show semantic meaning.
              // The View will contain a ViewObject corresponding to each SceneObject, through which the
              // appearance of the object can be controlled in the View.

            studio.finished();

            }).catch(message => {
              console.error(`Error loading .XGF: ${message}`);
            });
          });
      });
  }
});
