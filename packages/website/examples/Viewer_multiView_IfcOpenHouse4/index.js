// Import the SDK from a bundle built for these examples.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a DemoHelper without the default View.
// We'll create three Views manually.
const demoHelper = new xeokit.demo.DemoHelper({
  makeView: false,
  maxViews: 3
});

demoHelper.init().then(() => {

  const { viewer, scene, data } = demoHelper;

  // First View - perspective, side view
  const view1Result = viewer.createView({
    id: "demoView1",
    elementId: "demoCanvas1"
  });

  if (!view1Result.ok) {
    throw new Error("Failed to create View: " + view1Result.error);
  }

  const view1 = view1Result.value;

  //view1.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
  view1.camera.eye  = [3, 12, 3];
  view1.camera.look = [0, 0, 0];
  view1.camera.up   = [0, 0, 1];

  // Second View - orthographic, top view
  const view2Result = viewer.createView({
    id: "demoView2",
    elementId: "demoCanvas2"
  });

  if (!view2Result.ok) {
    throw new Error("Failed to create View: " + view2Result.error);
  }

  const view2 = view2Result.value;

 // view2.camera.projectionType = xeokit.constants.OrthoProjectionType;
  view2.camera.eye  = [0, 0, 30];
  view2.camera.look = [0, 0, 0];
  view2.camera.up   = [0, 1, 0];

  // Third View - perspective, alternate angle
  const view3Result = viewer.createView({
    id: "demoView3",
    elementId: "demoCanvas3"
  });

  if (!view3Result.ok) {
    throw new Error("Failed to create View: " + view3Result.error);
  }

  const view3 = view3Result.value;

 // view3.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
  view3.camera.eye  = [-3, 10, 3];
  view3.camera.look = [0, 0, 0];
  view3.camera.up   = [0, 0, 1];

  // Attach CameraControls to each View
  new xeokit.cameracontrol.CameraControl(view1, {});
  new xeokit.cameracontrol.CameraControl(view2, {});
  new xeokit.cameracontrol.CameraControl(view3, {});

  // Create SceneModel (geometry)
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

  // Create DataModel (metadata)
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const dataModel = dataModelResult.value;

  // Load IFC into both models
  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  fetch(`../../models/IfcOpenHouse4/ifc/model.ifc`)
    .then((response) => response.arrayBuffer())
    .then((fileData) => {
      return ifcLoader.load({
        fileData,
        sceneModel,
        dataModel
      });
    })
    .then(() => {
      demoHelper.finished();
    })
    .catch((err) => {
      console.error(err);
      throw err;
    });
});
