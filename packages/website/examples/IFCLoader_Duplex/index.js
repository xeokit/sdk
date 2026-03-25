// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {scene, data, renderer} = demoHelper;

  // Create an IFCLoader to load IFC files

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Arrange the View's Camera

  const view = demoHelper.createView({
    camera: {
      "eye": [24.40,23.70,27.04],
      "look": [4.39,8.90,2.54],
      "up": [-0.56,-0.41,0.71]
    }
  });

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




          }).catch(e => {
            console.error(e);
          });
        });
    });
});

