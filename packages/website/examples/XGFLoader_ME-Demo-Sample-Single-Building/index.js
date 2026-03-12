// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data, renderer} = demoHelper;

  // Create a XGFLoader to load .XGF files

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Configure the View's World-space coordinate axis to make the +Z axis "up"

  view.camera.worldAxis = [
    1, 0, 0, // Right +X
    0, 0, 1, // Up +Z
    0, -1, 0  // Forward -Y
  ];

// // Arrange the View's Camera within our +Z "up" coordinate system
//
   view.camera.eye = [  67.74194658396226, -4.121982515645583, 20.110348414033115];
   view.camera.look = [ 26.98026216623765, 26.288490354227463, 4.19249791964835];
   view.camera.up = [  -0.23942012120238962, 0.17862066842709445, 0.9543441006126097];

// Create a SceneModel to hold our model's geometry and materials

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

  // Create a DataModel to hold semantic data for our model

  const dataModelRes = data.createModel({
    id: "demoModel"
  });


  if (dataModelRes.ok === false) {
    console.error(`Error creating DataModel: ${dataModelRes.error}`);

  } else {

    const dataModel = dataModelRes.value;

    // Use the XGFLoader to load an IFC model from a .XGF file into our SceneModel and DataModel

    fetch("../../models/ME-Demo_Sample_Single_Building_01/ifc2xgf/model.xgf").then(response => {

      response
        .arrayBuffer()
        .then(fileData => {

          xgfLoader.load({
            fileData,
            sceneModel,
            dataModel
          }).then(() => {

            view.htmlElement.addEventListener("click", (e) => {
              const result = renderer.pick(view, {
                canvasPos: [e.offsetX, e.offsetY],
                pickViewObject: true
              });
              if (result) {
                if (result.ok) {
                  const pickResult = result.value;
                  if (pickResult) {
                    const sceneMesh = pickResult.sceneMesh;
                    if (sceneMesh) {
                      const sceneObject = sceneMesh.object;
                      console.log("Picked object: " + sceneObject.id);
                      const viewObject = view.objects[sceneObject.id];
                      if (viewObject) {
                        viewObject.highlighted = !viewObject.highlighted;
                      }
                    }
                  } else {
                    console.log("Nothing picked");
                  }
                } else {
                  console.error("Picking error: " + result.error);
                }
              } else {
                console.log("Nothing picked");
              }
            });


            // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
              // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
              // will have a corresponding DataObject with the same ID, to show semantic meaning.
              // The View will contain a ViewObject corresponding to each SceneObject, through which the
              // appearance of the object can be controlled in the View.

              demoHelper.finished();

              demoHelper.viewFit();

            }).catch(message => {
              console.error(`Error loading .XGF: ${message}`);
            });
          });
      });
  }
});
