// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene, data, loader, and view APIs used by this
// example.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create the demo helper without automatically creating a default View.
// This example creates and configures three separate Views manually.
const demoHelper = new xeokit.demo.DemoHelper({
  makeView: false,
  maxViews: 3
});

// Initialize the shared runtime context before creating Views or
// loading model content.
demoHelper.init().then(() => {

  // Access the core subsystems created by the DemoHelper. The Viewer
  // manages Views, the Scene manages renderable content, and the Data
  // subsystem manages metadata and semantic relationships.
  const { viewer, scene, data } = demoHelper;

  // Create the first View and bind it to the first canvas. This View
  // uses a perspective camera positioned to show the model from an
  // elevated side angle.
  const view1Result = viewer.createView({
    id: "demoView1",
    elementId: "demoCanvas1"
  });

  if (!view1Result.ok) {
    throw new Error("Failed to create View: " + view1Result.error);
  }

  const view1 = view1Result.value;

  view1.camera.eye = [15, 23, 8];
  view1.camera.look = [4, 10, 0];
  view1.camera.up = [0, 0, 1];

  // Create the second View and bind it to the second canvas. This View
  // is configured as a top-oriented architectural view.
  const view2Result = viewer.createView({
    id: "demoView2",
    elementId: "demoCanvas2"
  });

  if (!view2Result.ok) {
    throw new Error("Failed to create View: " + view2Result.error);
  }

  const view2 = view2Result.value;

  view2.camera.eye = [5, 9, 20];
  view2.camera.look = [5, 9, 0];
  view2.camera.up = [1, 0, 0];

  // Create the third View and bind it to the third canvas. This View
  // provides an alternate perspective angle onto the same model.
  const view3Result = viewer.createView({
    id: "demoView3",
    elementId: "demoCanvas3"
  });

  if (!view3Result.ok) {
    throw new Error("Failed to create View: " + view3Result.error);
  }

  const view3 = view3Result.value;

  view3.camera.eye = [5, 28, 2];
  view3.camera.look = [5, 9, 2];
  view3.camera.up = [0, 0, 1];

  // Attach independent interaction controllers to each View so that
  // each canvas can orbit, pan, and zoom separately.
  new xeokit.viewcontroller.ViewController(view1, {});
  new xeokit.viewcontroller.ViewController(view2, {});
  new xeokit.viewcontroller.ViewController(view3, {});

  // Create a SceneModel to hold renderable model content. The
  // coordinate system is defined explicitly so axis orientation and
  // units are interpreted consistently.
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

  const sceneModel = sceneModelResult.value;

  // Create a DataModel to hold semantic content such as object types,
  // relationships, and properties. The DataModel uses the same logical
  // model identifier as the SceneModel.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const dataModel = dataModelResult.value;

  // Create an IFCLoader and use it to load the IFC file into both the
  // renderable and semantic model layers.
  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  fetch(`../../models/Duplex/ifc/model.ifc`)
      .then((response) => response.arrayBuffer())
      .then((fileData) => {
        return ifcLoader.load({
          fileData,
          sceneModel,
          dataModel
        });
      })
      .then(() => {

        // Query the semantic graph and apply per-view appearance changes.
        // These changes are local to each View and do not affect the
        // appearance of the model in other Views.

        {
          // In the first View, X-ray exterior and envelope-style elements
          // so the model remains visible while appearing partially transparent.
          const resultObjectIds = [];
          const result = xeokit.data.searchObjects(data, {
            startObjectId: "1xS3BCk291UvhgP2a6eflK",
            includeObjects: [
              "IfcWallStandardCase",
              "IfcWall",
              "IfcRoof",
              "IfcDoor",
              "IfcWindow",
              "IfcStairCase"
            ],
            includeRelated: ["IfcRelAggregates"],
            resultObjectIds
          });

          if (!result.ok) {
            console.error(result);
            return;
          }

          view1.setObjectsXRayed(resultObjectIds, true);
        }

        {
          // In the second View, highlight furniture elements so they stand
          // out clearly from the rest of the model.
          const resultObjectIds = [];
          const result = xeokit.data.searchObjects(data, {
            startObjectId: "1xS3BCk291UvhgP2a6eflK",
            includeObjects: ["IfcFurnishingElement"],
            includeRelated: ["IfcRelAggregates"],
            resultObjectIds
          });

          if (!result.ok) {
            console.error(result);
            return;
          }

          view2.setObjectsHighlighted(resultObjectIds, true);
        }

        {
          // In the third View, hide envelope-style elements to expose the
          // interior of the building more clearly.
          const resultObjectIds = [];
          const result = xeokit.data.searchObjects(data, {
            startObjectId: "1xS3BCk291UvhgP2a6eflK",
            includeObjects: [
              "IfcWallStandardCase",
              "IfcWall",
              "IfcRoof",
              "IfcDoor",
              "IfcWindow",
              "IfcStairCase"
            ],
            includeRelated: ["IfcRelAggregates"],
            resultObjectIds
          });

          if (!result.ok) {
            console.error(result);
            return;
          }

          view3.setObjectsVisible(resultObjectIds, false);
        }

        // Signal that loading and setup have completed.
        demoHelper.finished();
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
});