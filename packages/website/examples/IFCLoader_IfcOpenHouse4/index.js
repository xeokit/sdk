// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

import {DataGraphOverlay} from "../../js/DataGraphOverlay.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data, renderer} = demoHelper;

  renderer.setDrawLogger(new xeokit.webglrenderer.internal.drawOps.DrawLogger({
    enabled: true,
    maxLoggedOps: 100,
    includeRenderPasses:[
      "normalFillTransparent",
      "edgesTransparent"
    ],
    onFrameLogged: (frameLog) => {
      console.log("[WebGLRenderer] Frame rendered:", frameLog);
    }
  }))
// Create an IFCLoader to load IFC files

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

// Arrange the View's Camera

  view.camera.eye = [-6.01, 4.85, 9.11];
  view.camera.look = [3.93, -2.65, -12.51];
  view.camera.up = [0.12, 0.95, -0.27];


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

  fetch(`../../models/IfcOpenHouse4/ifc/model.ifc`)
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
            // IfcMember elements within a given IfcBuildingStorey.

            const resultObjectIds = [];

            const result = xeokit.data.searchObjects(data, {
              startObjectId: "38aOKO8_DDkBd1FHm_lVXz",
              includeObjects: ["IfcMember"],
              includeRelated: ["IfcRelAggregates"],
              resultObjectIds
            });

            // Check if the query was valid.

            if (!result.ok) {
              console.error("Error querying IFC data: " + result.error);
              return;
            }

            // const er = new DataGraphOverlay(data, {
            //   width: 2000,
            //   height: 1200,
            //   maxObjectsPerModel: 80,
            //   maxPropertySetsPerModel: 80,
            //   maxPropertiesPerSet: 12,
            //   maxRelationshipEdges: 150,
            //   showPropertyNodes: false, // big win for readability
            // });
            // er.start();

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

