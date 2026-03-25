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
  view1.camera.eye = [3.27, 2.39, 3.91];
  view1.camera.look = [0, 0, 0];
  view1.camera.up = [-0.18, 0.93, -0.28];

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
  view2.camera.eye = [3.27, 2.39, 3.91];
  view2.camera.look = [0, 0, 0];
  view2.camera.up = [-0.18, 0.93, -0.28];

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
  view3.camera.eye = [3.27, 2.39, 3.91];
  view3.camera.look = [0, 0, 0];
  view3.camera.up = [-0.18, 0.93, -0.28];

  // ---------------------------------------------------------------------------
  // Attach CameraControls so each canvas can orbit/pan/zoom independently.
  // (Each View gets its own controller instance.)
  // ---------------------------------------------------------------------------

  new xeokit.viewcontroller.ViewController(view1, {});
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

      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0
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

  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Fetch the IFC file as an ArrayBuffer, then hand it to the loader.
  fetch(`../../models/SportsCar/xgf/model.xgf`)
    .then((response) => response.arrayBuffer())
    .then((fileData) => {
      // Loader populates both the sceneModel (renderable objects) and dataModel (metadata).
      return xgfLoader.load({
        fileData,
        sceneModel,
        dataModel
      });
    })
    .then(() => {


      // Signal to DemoHelper that everything is loaded and ready (often hides spinners, etc).
      demoHelper.finished();
    })
    .catch((err) => {
      console.error(err);
      throw err;
    });
});
