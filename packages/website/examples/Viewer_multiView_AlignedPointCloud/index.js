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
  view1.camera.eye  = [727.80, 110.64, -49.91];
  view1.camera.look = [749.5687338911332,94.21960449131437,-97.251870596337];
  view1.camera.up   = [0, 1, 0];

  // ---------------------------------------------------------------------------
  // VIEW 2 - Orthographic, top view
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

  // Scene AABB: 694.785, 78.559, 78.515, 802.587, 114.385, 106.558

  // Top-ish camera looking down.
  // Note: up is set to +X to keep the plan oriented nicely (so it’s not “rotated”).
  view2.camera.eye  = [(802.587 + 694.785) / 2, 100+((114.385 + 78.559) / 2), (106.558 - 78.515) / 2];
  view2.camera.look = [(802.587 + 694.785) / 2, (114.385 + 78.559) / 2, (106.558 + 78.515) / 2];
  view2.camera.up   = [0, 1, 0];

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
  view3.camera.eye  = [727.80, 110.64, -49.91];
  view3.camera.look = [749.5687338911332,94.21960449131437,-97.251870596337];
  view3.camera.up   = [0, 1, 0];

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
  const ifcSceneModelResult = scene.createModel({
    id: "demoModel",
    // coordinateSystem: {
    //   // 3x3 basis matrix, row-major:
    //   // [ Xx Xy Xz
    //   //   Yx Yy Yz
    //   //   Zx Zy Zz ]
    //   // Identity means X-right, Y-forward, Z-up (no axis remap).
    //   basis: [
    //     1, 0, 0,
    //     0, 1, 0,
    //     0, 1, 0
    //   ],
    //   // Model origin in world coordinates.
    //   origin: [0, 0, 0],
    //
    //   // Units metadata (helps tools that care about real-world scale).
    //   units: "meters",
    //
    //   // If your source data is not in meters, set scaleToMeters accordingly.
    //   // e.g. millimeters -> 0.001
    //   scaleToMeters: 1
    // }
  });

  if (!ifcSceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + ifcSceneModelResult.error);
  }

  const ifcSceneModel = ifcSceneModelResult.value;

  //-------------------------------------------------------------------------
  //
  //-------------------------------------------------------------------------

  // SceneModel holds the triangles/meshes that get drawn.
  // We also define the coordinate system so units/orientation are consistent.
  const lasSceneModelResult = scene.createModel({
    id: "lasModel",
    // coordinateSystem: {
    //   basis: [
    //     1, 0, 0,
    //     0, 0, -1,
    //     0, 1, 0
    //   ],
    //   origin: [0, 0, 0],
    //   units: "meters",
    //   scaleToMeters: 1
    // }
  });

  if (!lasSceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + lasSceneModelResult.error);
  }

  const lasSceneModel = lasSceneModelResult.value;

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

  const lasLoader = new xeokit.formats.las.LASLoader();

  // Fetch the IFC file as an ArrayBuffer, then hand it to the loader.
  // fetch(`../../models/AlignedPointCloud/xgf/model.xgf`)
  //   .then((response) => response.arrayBuffer())
  //   .then((fileData) => {
  //     // Loader populates both the ifcSceneModel (renderable objects) and dataModel (metadata).
  //     return xgfLoader.load({
  //       fileData,
  //       sceneModel: ifcSceneModel,
  //       dataModel
  //     });
  //   })
  //   .then(() => {

      fetch(`../../models/AlignedPointCloud/laz/model.laz`)
        .then((response) => response.arrayBuffer())
        .then((fileData) => {

          return lasLoader.load({
            fileData,
            sceneModel: lasSceneModel
          });
        })
        .then(() => {

          // Signal to DemoHelper that everything is loaded and ready (often hides spinners, etc).
          demoHelper.finished();
        });

    // })
    // .catch((err) => {
    //   console.error(err);
    //   throw err;
    // });
});
