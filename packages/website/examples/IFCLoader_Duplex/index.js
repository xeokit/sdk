// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data, renderer} = demoHelper;

  // Create an IFCLoader to load IFC files

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Arrange the View's Camera

  view.camera.eye = [14.915582703146043, 14.396781491179095, 5.431098754133695];
  view.camera.look = [6.599999999999998, 8.34099990051474, -4.159999575600315];
  view.camera.up = [-0.2820584034861215, -0.3253229483893775, 0.9025563895259413];

  view.selectedMaterial.fillAlpha = 0.5;
  view.selectedMaterial.edges = true;

  // Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0,0,0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  // Create a DataModel to hold semantic data for our model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Load our IFC data into the SceneModel and DataModel

  fetch(`../../models/Duplex/ifc/model.ifc`)
    .then(response => {
      response
        .arrayBuffer()
        .then(fileData => {

          ifcLoader.load({
            fileData,
            sceneModel,
            dataModel

          }).then(() => { // IFC file loaded

            // const transform = sceneModel.createTransform({
            //   id: "modelTransform",
            //   parent: null,
            //   position: [-1842009.4968455553, -9.685518291306686, 5173295.851503017]
            // }).value;
            //
            // // iterate over objects in sceneModel
            //
            // for (const sceneMeshId in sceneModel.meshes) {
            //   const sceneMesh = sceneModel.meshes[sceneMeshId];
            //   sceneMesh.setParentTransformId(transform.id);
            // }


            demoHelper.viewFit();

            // The IFC model now appears in our Viewer.  The DataModel and the Data will then contain DataObject,
            // Relationship and PropertySet components that represent the IFC data as an
            // entity-relationship graph.

            // Using the searchObjects function, query the Data for all the
            // IfcFurnishingElement elements within the IfcBuilding.

            const resultObjectIds = [];

            const result = xeokit.data.searchObjects(data, {
              startObjectId: "1xS3BCk291UvhgP2a6eflK", // IfcBuilding
              includeObjects: ["IfcFurnishingElement"],
              includeRelated: ["IfcRelAggregates"],
              resultObjectIds
            });

            // Check if the query was valid.

            if (!result.ok) {
              console.error(result);
              return;
            }

            // If the query succeeded, go ahead and mark whatever
            // objects we found as selected. In this case, it will set the furniture
            // objects as selected in the View.

            view.setObjectsSelected(resultObjectIds, true);

            demoHelper.finished();

            // Attach a mouse click listener to the View's canvas, and log any object that is picked when the user clicks.

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


          }).catch(e => {
            console.error(e);
          });
        });
    });
});

