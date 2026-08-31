// Import the xeokit SDK bundle used by this example. This bundle provides
// the demo helper together with the scene, data, loader, and rendering
// APIs needed by the sample.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared rendering
// context and provides utilities for setting up and finalizing the demo.
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  // Access the Scene, Data, and Renderer subsystems created by the
  // Studio. The Scene manages renderable content, while the Data
  // subsystem manages semantic model structure.
  const { scene, data, renderer } = studio;

  // Create an IFCLoader to parse IFC data into renderable scene content
  // and corresponding semantic objects.
  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Create a View and configure its initial camera so that the loaded
  // model is framed clearly.
  const view = studio.viewManager.createView({
    camera: {
      eye: [24.40, 23.70, 27.04],
      look: [4.39, 8.90, 2.54],
      up: [-0.56, -0.41, 0.71]
    },
    effects: {
      bloom: {
        enabled: true,
        threshold: 0.8,
        knee: 0.5,
        intensity: 0.6
      },
      tonemap: {
        exposure: 1.0,
        mode: "aces"
      }
    }
  });

  // Create a SceneModel to hold the renderable model content. The
  // coordinate system is defined explicitly so that axes and units are
  // interpreted consistently.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  // Ensure that the SceneModel was created successfully before continuing.
  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  // Create a DataModel to hold semantic content such as object types,
  // relationships, and metadata.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  // Ensure that the DataModel was created successfully before continuing.
  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Fetch the IFC file and load it into both the SceneModel and DataModel.
  // This keeps the renderable model and its semantic representation linked.
  fetch(`../../../../models/Duplex/ifc/model.ifc`)
      .then(response => {
        response
            .arrayBuffer()
            .then(fileData => {

              ifcLoader.load({
                fileData,
                sceneModel,
                dataModel

              }).then(() => {

                // At this point, the IFC model is loaded into the SceneModel,
                // while the DataModel contains DataObject, Relationship, and
                // PropertySet components representing the IFC structure as an
                // entity-relationship graph.

                // Query the semantic model for all IfcFurnishingElement objects
                // that are contained within the specified IfcBuilding.
                const resultObjectIds = [];

                const result = xeokit.model.data.searchObjects(data, {
                  startObjectId: "1xS3BCk291UvhgP2a6eflK", // IfcBuilding
                  includeObjects: ["IfcFurnishingElement"],
                  includeRelated: ["IfcRelAggregates"],
                  resultObjectIds
                });

                // Ensure that the query completed successfully before using
                // the results.
                if (!result.ok) {
                  console.error(result);
                } else {

                  // Select the matching furnishing objects in the View so that
                  // they are visually distinguished in the loaded model.
                  view.setObjectsInStyleBin("selected", resultObjectIds, true);
                }

                // Signal that loading and setup have completed.
                studio.openInfoPanelFromMeta();
                studio.finished();

              }).catch(e => {
                console.error(e);
              });
            });
      });
});
