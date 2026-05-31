// Import the xeokit SDK bundle used by this example.
// It provides the helper, loader, and rendering APIs used in this sample.
import * as xeokit from "../../js/xeokit-studio-bundle.js";
// Create the demo helper.
// It initializes the scene, data, viewer, and renderer context for this demo.
const studio = new xeokit.studio.Studio();

studio.init({
  logging: false
}).then(() => {

  const {scene, data, renderer} = studio;

  // Create an xgfLoader to load IFC files

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();
  // Create a view and set the initial camera.
  // The camera is placed to frame the model after loading.
  const view = studio.viewManager.createView({
    camera: {
      "eye": [213.40728695310605,113.76051876858196,322.9017599849709],
      "look": [23.18664754453066,-26.932407930414342,89.99792862514586],
      "up": [-0.56,-0.41,0.71]
    }
  });
  // Create a SceneModel for renderable model content.
  // Geometry and material data loaded from files is stored here.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 0, 1, // Up
        0, 1, 0  // Forward
      ],
      origin: [0,0,0],
      units: "meters",
      scaleToMeters: 1
    },
    deferredBuild: true
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }
  // Create a DataModel for semantic model data.
  // Metadata, relationships, and object meaning are stored here.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;
  // Fetch and load the IFC file.
  // The loader populates both SceneModel and DataModel so graphics and metadata stay linked.
  fetch(`../../models/HolterTower/xgf/model.xgf`)
    .then(response => {
      response
        .arrayBuffer()
        .then(fileData => {

          xgfLoader.load({
            fileData,
            sceneModel,
            dataModel

          }).then(() => { // IFC file loaded


            // // The IFC model now appears in our Viewer.  The DataModel and the Data will then contain DataObject,
            // // Relationship and PropertySet components that represent the IFC data as an
            // // entity-relationship graph.
            //
            // // Using the searchObjects function, query the Data for all the
            // // IfcFurnishingElement elements within the IfcBuilding.
            //
            // const resultObjectIds = [];
            //
            // const result = xeokit.model.data.searchObjects(data, {
            //   startObjectId: "1xS3BCk291UvhgP2a6eflK", // IfcBuilding
            //   includeObjects: ["IfcFurnishingElement"],
            //   includeRelated: ["IfcRelAggregates"],
            //   resultObjectIds
            // });
            //
            // // Check if the query was valid.
            //
            // if (!result.ok) {
            //   console.error(result);
            //   return;
            // }
            //
            // // If the query succeeded, go ahead and mark whatever
            // // objects we found as selected. In this case, it will set the furniture
            // // objects as selected in the View.
            //
            // view.setObjectsSelected(resultObjectIds, true);

            studio.openInfoPanelFromMeta();
            studio.finished();




          }).catch(e => {
            console.error(e);
          });
        });
    });
});

