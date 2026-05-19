// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene, data, loader, and UI APIs used by this
// example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared runtime
// context and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  // Access the Scene, Data, and Renderer subsystems created by the
  // Studio. The Scene manages renderable content, while the Data
  // subsystem manages semantic model structure and metadata.
  const { scene, data, renderer } = studio;

  // Create an IFCLoader to parse IFC data into renderable geometry and
  // corresponding semantic objects.
  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Create a View and position the camera to frame the model after it
  // has loaded.
  const view = studio.viewManager.createView({
    camera: {
      eye: [-28.61, 13.52, 19.06],
      look: [-0.00, 0.00, -1.17],
      up: [0.49, -0.23, 0.84],
    }
  });

  // Create a SceneModel to hold the renderable model content. Geometry
  // and material state loaded from the IFC file will be stored here.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  // Create a DataModel to hold semantic content such as object types,
  // relationships, and metadata.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Fetch the IFC file and load it into both the renderable and semantic
  // model layers so that geometry and metadata remain linked.
  fetch(`../../models/IfcOpenHouse4/ifc/model.ifc`)
      .then(response => response.arrayBuffer())
      .then(fileData => {

        ifcLoader.load({
          fileData,
          sceneModel,
          dataModel
        }).then(() => {

          // Create a tabbed tree panel that presents the model hierarchy in
          // multiple ways, including aggregation, type, and grouped views.
          // The panel manages its own DOM and styling unless a host element
          // is provided explicitly.
          const treePanel = new xeokit.ui.treeview.TabbedTreeViewPanel({
            data,
            view,
            linkType: ["IfcRelAggregates", "IfcRelContainedInSpatialStructure"],
            autoExpandDepth: 4,
            sortNodes: true,
            pruneEmptyNodes: true,
            rootName: "IfcOpenHouse4",
            title: "IfcOpenHouse4",
            subtitle: "Browse IFC structure"
          });

          // Log tree panel context-menu events for debugging.
          treePanel.events.onContextMenu.subscribe((treePanelInstance, event) => {
            console.log("Tree node context menu:", event.treeViewNode);
          });

          // Attach the same interaction behavior to each tab so selection
          // works consistently regardless of which hierarchy view is active.
          const attachTreeHandlers = (treeView) => {
            treeView.events.onNodeTitleClicked.subscribe((treeViewInstance, event) => {

              const objectId = event.treeViewNode.objectId;

              const resultObjectIds = [];
              const result = xeokit.model.data.searchObjects(data, {
                startObjectId: objectId,
                resultObjectIds
              });

              // Stop if the query fails.
              if (!result.ok) {
                console.error("Error querying IFC data: " + result.error);
                return;
              }

              // Clear the current selection and select the clicked object
              // together with any related objects returned by the query.
              view.setObjectsSelected(view.selectedObjectIds, false);
              view.setObjectsSelected(resultObjectIds, true);

              console.log("Tree node clicked:", event.treeViewNode);
            });

            // Log per-tree context-menu events for debugging.
            treeView.events.onContextMenu.subscribe((treeViewInstance, event) => {
              console.log("Tree node context menu:", event.treeViewNode);
            });
          };

          attachTreeHandlers(treePanel.aggregationTreeView);
          attachTreeHandlers(treePanel.typesTreeView);
          attachTreeHandlers(treePanel.groupsTreeView);

          // Signal that loading and UI setup have completed.
          studio.finished();

        }).catch(e => {
          console.error(e);
        });
      })
      .catch(e => {
        console.error(e);
      });
});
