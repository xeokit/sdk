// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

import {DemoHelper} from "../../js/DemoHelper.js";

const demoHelper = new DemoHelper({});

demoHelper.init().then(({
                          scene,
                          data,
                          view
                        }) => {

// Create an IFCLoader to load IFC files

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

// Arrange the View's Camera

  view.camera.eye = [14.915582703146043, 14.396781491179095, 5.431098754133695];
  view.camera.look = [6.599999999999998, 8.34099990051474, -4.159999575600315];
  view.camera.up = [-0.2820584034861215, 0.9025563895259413, -0.3253229483893775];

// Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel"
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
            // IfcMember elements within the IfcSite.

            const resultObjectIds = [];

            const result = xeokit.data.searchObjects(data, {
              startObjectId: "1xS3BCk291UvhgP2a6eflN",
              includeObjects: ["IfcMember"],
              includeRelated: ["IfcRelAggregates"],
              resultObjectIds
            });

            // Check if the query was valid.

            if (!result.ok) {
              console.error(result);
              return;
            }

            // If the query succeeded, go ahead and mark whatever
            // objects we found as selected. In this case, it will set the window
            // frames as selected in the View.

            view.setObjectsSelected(resultObjectIds, true);

            demoHelper.finished();

          }).catch(e => {
            console.error(e);
          });
        });
    });
});

