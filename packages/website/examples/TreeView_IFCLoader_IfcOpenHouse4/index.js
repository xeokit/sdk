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
      "eye": [-28.61121936096161,13.521426697632066,19.058116784372952],
      "look": [-0.0015259021896687486,0.0015259021896687486,-1.1749992675781256],
      "up": [0.4870560392709646,-0.23016497899858748,0.8424965857807737],
    }
  });

  // Create a SceneModel to hold our model's geometry and materials
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
    .then(response => response.arrayBuffer())
    .then(fileData => {

      ifcLoader.load({
        fileData,
        sceneModel,
        dataModel
      }).then(() => {

        // Create a TabbedTreeViewPanel to show the model hierarchy in three tabs:
        //
        // - Aggregation: follows IfcRelAggregates
        // - Types: groups objects by IFC type
        // - Groups: groups objects using groupTypes, then by type
        //
        // The panel creates and manages its own DOM and styling unless we provide
        // a panelElement explicitly.

        const treePanel = new xeokit.ui.treeview.TabbedTreeViewPanel({
          data,
          view,
          linkType: "IfcRelAggregates",
          autoExpandDepth: 4,
          sortNodes: true,
          pruneEmptyNodes: true,
          rootName: "IfcOpenHouse4",
          title: "IfcOpenHouse4",
          subtitle: "Browse IFC structure"
        });

        treePanel.events.onContextMenu.subscribe((treePanelInstance, event) => {
          console.log("Tree node context menu:", event.treeViewNode);
        });

        // Wire the same node-click behavior onto each tab's TreeView so selection
        // works consistently regardless of which hierarchy tab is currently active.

        const attachTreeHandlers = (treeView) => {
          treeView.events.onNodeTitleClicked.subscribe((treeViewInstance, event) => {

            const objectId = event.treeViewNode.objectId;

            //   treeView.showNode(objectId);

            const resultObjectIds = [];

            const result = xeokit.data.searchObjects(data, {
              startObjectId: objectId,
              resultObjectIds
            });

            // Check if the query was valid.

            if (!result.ok) {
              console.error("Error querying IFC data: " + result.error);
              return;
            }

            // If the query succeeded, go ahead and mark whatever
            // objects we found as selected. In this case, it will set the window
            // frames as selected in the View.

            view.setObjectsSelected(view.selectedObjectIds, false);
            view.setObjectsSelected(resultObjectIds, true);

            console.log("Tree node clicked:", event.treeViewNode);
          });

          treeView.events.onContextMenu.subscribe((treeViewInstance, event) => {
            console.log("Tree node context menu:", event.treeViewNode);
          });
        };

        attachTreeHandlers(treePanel.aggregationTreeView);
        attachTreeHandlers(treePanel.typesTreeView);
        attachTreeHandlers(treePanel.groupsTreeView);

        demoHelper.finished();

      }).catch(e => {
        console.error(e);
      });
    })
    .catch(e => {
      console.error(e);
    });
});
