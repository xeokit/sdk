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
  // subsystem manages semantic model structure and metadata.
  const { viewer, scene, data } = demoHelper;

  // Create the first View and bind it to the first canvas. This View
  // uses a perspective camera positioned to show the model from an
  // angled exterior viewpoint.
  const view1Result = viewer.createView({
    id: "demoView1",
    elementId: "demoCanvas1"
  });

  if (!view1Result.ok) {
    throw new Error("Failed to create View: " + view1Result.error);
  }

  const view1 = view1Result.value;

  view1.camera.eye = [3.27, 2.39, 3.91];
  view1.camera.look = [0, 0, 0];
  view1.camera.up = [-0.18, 0.93, -0.28];

  // Create the second View and bind it to the second canvas. This View
  // is configured independently, allowing it to maintain its own camera
  // state and presentation settings.
  const view2Result = viewer.createView({
    id: "demoView2",
    elementId: "demoCanvas2"
  });

  if (!view2Result.ok) {
    throw new Error("Failed to create View: " + view2Result.error);
  }

  const view2 = view2Result.value;

  view2.camera.eye = [3.27, 2.39, 3.91];
  view2.camera.look = [0, 0, 0];
  view2.camera.up = [-0.18, 0.93, -0.28];

  // Create the third View and bind it to the third canvas. Like the
  // other Views, it has its own camera and per-view object state.
  const view3Result = viewer.createView({
    id: "demoView3",
    elementId: "demoCanvas3"
  });

  if (!view3Result.ok) {
    throw new Error("Failed to create View: " + view3Result.error);
  }

  const view3 = view3Result.value;

  view3.camera.eye = [3.27, 2.39, 3.91];
  view3.camera.look = [0, 0, 0];
  view3.camera.up = [-0.18, 0.93, -0.28];

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

  // Create a DataModel to hold semantic content associated with the
  // model. The DataModel uses the same logical identifier as the
  // SceneModel so both layers correspond to the same model.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const dataModel = dataModelResult.value;

  // Create an XGFLoader to load the model into both the renderable and
  // semantic model layers.
  const xgfLoader = new xeokit.formats.xgf.XGFLoader();

  // Fetch the XGF file as binary data, then load it into the SceneModel
  // and DataModel.
  fetch(`../../models/SportsCar/xgf/model.xgf`)
      .then((response) => response.arrayBuffer())
      .then((fileData) => {
        return xgfLoader.load({
          fileData,
          sceneModel,
          dataModel
        });
      })
      .then(() => {

        // Signal that loading and setup have completed.
        demoHelper.finished();
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
});