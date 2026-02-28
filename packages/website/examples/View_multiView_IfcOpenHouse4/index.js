// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({
  makeView: false, // Disable the default View, as we'll create three Views in this demo
  maxViews: 3 // Ensure that WebGLRenderer creates enough GPU memory for three Views
});

demoHelper.init().then(() => {

  const {viewer, scene, data} = demoHelper;

  // First View - perspective projection, looking at the model from the side

  const view1Result = viewer.createView({
    id: "demoView1",
    elementId: "demoCanvas1"
  });

  if (!view1Result.ok) {
    throw new Error("Failed to create View: " + view1Result.error);
  }

  const view1 = view1Result.value;

  view1.camera.eye = [3, 12, 3];
  view1.camera.look = [0, 0, 0];
  view1.camera.up = [0, 0, 1];

  // Create the second View - orthographic projection, looking at the model from above

  const view2Result = viewer.createView({
    id: "demoView2",
    elementId: "demoCanvas2"
  });

  if (!view2Result.ok) {
    throw new Error("Failed to create View: " + view2Result.error);
  }

  const view2 = view2Result.value;

   //view2.camera.projectionType = xeokit.constants.OrthoProjectionType;

  view2.camera.eye = [3, -13, 3];
  view2.camera.look = [0, 0, 0];
  view2.camera.up = [0, 0, 1];

  // Create the third View, with default perspective projection

  const view3Result = viewer.createView({
    id: "demoView3",
    elementId: "demoCanvas3"
  });

  if (!view3Result.ok) {
    throw new Error("Failed to create View: " + view3Result.error);
  }

  const view3 = view3Result.value;

  view3.camera.eye = [-3, 10, 3];
  view3.camera.look = [0, 0, 0];
  view3.camera.up = [0, 0, 1];

  // Attach a CameraControl to each View, to control
  // its Camera with mouse and touch input

  const cameraControl1 = new xeokit.cameracontrol.CameraControl(view1, {});
  const cameraControl2 = new xeokit.cameracontrol.CameraControl(view2, {});
  const cameraControl3 = new xeokit.cameracontrol.CameraControl(view3, {});

  const sceneModel = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0,0,0],
      units: "meters",
      scaleToMeters: 1
    }
  }).value;

  const dataModel = data.createModel({
    id: "demoModel"
  }).value;

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  fetch(`../../models/IfcOpenHouse4/ifc/model.ifc`)
    .then(response => {
      response
        .arrayBuffer()
        .then(fileData => {

          ifcLoader.load({
            fileData,
            sceneModel,
                    dataModel

          }).then(() => { // IFC file loaded

            // view1.setObjectsSelected(["1hwEPyGUD1vwPpm508N9dQ"], true);
            //
            // view2.setObjectsSelected(["1hwEPyGUD1vwPpm508N9dQ"], true);
            //
            // view3.setObjectsSelected(["279dlwph95$gPMCup$shvv"], true);

            demoHelper.finished();
          });
        });
    });
});
