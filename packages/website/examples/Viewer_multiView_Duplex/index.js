// Import the xeokit SDK from a prebuilt bundle used by these demos/examples.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a DemoHelper, but *don’t* let it auto-create the default View.
// We’ll create and configure three separate Views (and canvases) ourselves.
const demoHelper = new xeokit.demo.DemoHelper({
  makeView: false,
  maxViews: 3
});

// DemoHelper.init() creates the core pieces (Viewer, Scene, Data, etc).
// We wait for that to complete before creating Views and loading models.
demoHelper.init().then(() => {

  // Convenience handles:
  // - viewer: manages Views, render loop, interactions
  // - scene: holds renderable geometry (SceneModels)
  // - data: holds metadata graph (DataModels) for search/query, BIM relationships, etc
  const { viewer, scene, data } = demoHelper;

  // ---------------------------------------------------------------------------
  // VIEW 1 - Perspective, side-ish view
  // ---------------------------------------------------------------------------

  // Create a View bound to <canvas id="demoCanvas1">.
  // Each View has its own Camera, ViewController, and per-View object states
  // (visibility/xray/highlight/etc).
  const view1Result = viewer.createView({
    id: "demoView1",
    elementId: "demoCanvas1"
  });

  if (!view1Result.ok) {
    throw new Error("Failed to create View: " + view1Result.error);
  }

  const view1 = view1Result.value;

  // Choose projection type (Perspective is default in many setups).
  // Uncomment if you want to be explicit:
  // view1.camera.projectionType = xeokit.constants.PerspectiveProjectionType;

  // Position the camera for View 1.
  // eye  = camera position
  // look = target point
  // up   = “up” direction (Z-up here)
  view1.camera.eye  = [15, 23, 8];
  view1.camera.look = [4, 10, 0];
  view1.camera.up   = [0, 0, 1];

  // ---------------------------------------------------------------------------
  // VIEW 2 - Orthographic, top view
  // ---------------------------------------------------------------------------

  const view2Result = viewer.createView({
    id: "demoView2",
    elementId: "demoCanvas2"
  });

  if (!view2Result.ok) {
    throw new Error("Failed to create View: " + view2Result.error);
  }

  const view2 = view2Result.value;

  // Set orthographic projection for an architectural “plan” style view.
  // Uncomment if you want it explicitly orthographic:
  // view2.camera.projectionType = xeokit.constants.OrthoProjectionType;

  // Top-ish camera looking down.
  // Note: up is set to +X to keep the plan oriented nicely (so it’s not “rotated”).
  view2.camera.eye  = [5, 9, 20];
  view2.camera.look = [5, 9, 0];
  view2.camera.up   = [1, 0, 0];

  // ---------------------------------------------------------------------------
  // VIEW 3 - Perspective, alternate angle
  // ---------------------------------------------------------------------------

  const view3Result = viewer.createView({
    id: "demoView3",
    elementId: "demoCanvas3"
  });

  if (!view3Result.ok) {
    throw new Error("Failed to create View: " + view3Result.error);
  }

  const view3 = view3Result.value;

  // Uncomment if you want to be explicit:
  // view3.camera.projectionType = xeokit.constants.PerspectiveProjectionType;

  // Another perspective angle.
  view3.camera.eye  = [5, 28, 2];
  view3.camera.look = [5, 9, 2];
  view3.camera.up   = [0, 0, 1];

  // ---------------------------------------------------------------------------
  // Attach CameraControls so each canvas can orbit/pan/zoom independently.
  // (Each View gets its own controller instance.)
  // ---------------------------------------------------------------------------

  new xeokit.viewcontroller.ViewController(view1, {

  });
  new xeokit.viewcontroller.ViewController(view2, {});
  new xeokit.viewcontroller.ViewController(view3, {});

  // ---------------------------------------------------------------------------
  // Create the SceneModel (renderable geometry)
  // ---------------------------------------------------------------------------

  // SceneModel holds the triangles/meshes that get drawn.
  // We also define the coordinate system so units/orientation are consistent.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      // 3x3 basis matrix, row-major:
      // [ Xx Xy Xz
      //   Yx Yy Yz
      //   Zx Zy Zz ]
      // Identity means X-right, Y-forward, Z-up (no axis remap).
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      // Model origin in world coordinates.
      origin: [0, 0, 0],

      // Units metadata (helps tools that care about real-world scale).
      units: "meters",

      // If your source data is not in meters, set scaleToMeters accordingly.
      // e.g. millimeters -> 0.001
      scaleToMeters: 1
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // ---------------------------------------------------------------------------
  // Create the DataModel (metadata graph / BIM semantics)
  // ---------------------------------------------------------------------------

  // DataModel stores IFC object tree, types, relationships, properties, etc.
  // IMPORTANT: we use the same id as the SceneModel ("demoModel") so the
  // geometry + metadata correspond to the same logical model.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const dataModel = dataModelResult.value;

  // ---------------------------------------------------------------------------
  // Load IFC into both models (geometry -> SceneModel, metadata -> DataModel)
  // ---------------------------------------------------------------------------

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Fetch the IFC file as an ArrayBuffer, then hand it to the loader.
  fetch(`../../models/Duplex/ifc/model.ifc`)
    .then((response) => response.arrayBuffer())
    .then((fileData) => {
      // Loader populates both the sceneModel (renderable objects) and dataModel (metadata).
      return ifcLoader.load({
        fileData,
        sceneModel,
        dataModel
      });
    })
    .then(() => {

      // -----------------------------------------------------------------------
      // Per-view filtering/appearance driven by metadata queries
      // -----------------------------------------------------------------------
      //
      // xeokit.data.searchObjects() traverses the DataModel graph and returns a set
      // of matching object IDs (typically entity IDs from the loaded IFC data graph).
      //
      // We then apply a *view-local* state change:
      // - xray some objects in view1
      // - highlight some objects in view2
      // - hide some objects in view3
      //
      // These state changes do not affect other Views.

      {
        // View 1: X-ray the building envelope-ish elements (walls/roof/doors/windows/stairs).
        const resultObjectIds = [];
        const result = xeokit.data.searchObjects(data, {
          startObjectId: "1xS3BCk291UvhgP2a6eflK", // IFC element ID: IfcBuilding
          includeObjects: [
            "IfcWallStandardCase",
            "IfcWall",
            "IfcRoof",
            "IfcDoor",
            "IfcWindow",
            "IfcStairCase"
          ],
          // Follow relationships while traversing from the startObjectId.
          // IfcRelAggregates is commonly used for decomposition (building -> storeys -> spaces, etc).
          includeRelated: ["IfcRelAggregates"],
          // Output array (filled by the function)
          resultObjectIds
        });
        if (!result.ok) {
          console.error(result);
          return;
        }
        view1.setObjectsXRayed(resultObjectIds, true);
      }

      {
        // View 2: Highlight furnishing elements.
        const resultObjectIds = [];
        const result = xeokit.data.searchObjects(data, {
          startObjectId: "1xS3BCk291UvhgP2a6eflK", // IfcBuilding
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
        // View 3: Hide envelope-ish elements (so you can “see inside” in this view).
        const resultObjectIds = [];
        const result = xeokit.data.searchObjects(data, {
          startObjectId: "1xS3BCk291UvhgP2a6eflK", // IfcBuilding
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

      // Signal to DemoHelper that everything is loaded and ready (often hides spinners, etc).
      demoHelper.finished();
    })
    .catch((err) => {
      console.error(err);
      throw err;
    });
});
