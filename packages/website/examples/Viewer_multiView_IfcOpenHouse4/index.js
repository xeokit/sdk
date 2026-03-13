// Import the SDK from a bundle built for these examples.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a DemoHelper without the default View.
// We'll create three Views manually.
const demoHelper = new xeokit.demo.DemoHelper({
  makeView: false,
  maxViews: 3
});

demoHelper.init().then(() => {

  const {viewer, scene, data, renderer} = demoHelper;

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
  view1.camera.eye = [3, 12, 3];
  view1.camera.look = [0, 0, 0];
  view1.camera.up = [0, 0, 1];

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
  view2.camera.eye = [0, 0, 30];
  view2.camera.look = [0, 0, 0];
  view2.camera.up = [0, 1, 0];

  // Third View - perspective, alternate angle
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

  // Attach CameraControls to each View
  new xeokit.cameracontrol.CameraControl(view1, {});
  new xeokit.cameracontrol.CameraControl(view2, {});
  new xeokit.cameracontrol.CameraControl(view3, {});


  // Create a ContextMenu that will show when the user right-clicks on the View's canvas, but not on any object
  // in the View. This ContextMenu will have options to hide and show all objects in the View, as well as an
  // option to view fit the whole model.

  const canvasContextMenu = new xeokit.ui.contextmenu.ContextMenu({
    enabled: true,
    items: [
      [
        {
          title: "Hide All",
          getEnabled: function (context) {
            return (context.view.numVisibleObjects > 0);
          },
          doAction: function (context) {
            context.view.setObjectsVisible(context.view.visibleObjectIds, false);
          }
        },
        {
          title: "Show All",
          getEnabled: function (context) {
            return (context.view.numVisibleObjects < context.view.numObjects);
          },
          doAction: function (context) {
            const view = context.view;
            view.setObjectsVisible(view.objectIds, true);
            view.setObjectsXRayed(view.xrayedObjectIds, false);
            view.setObjectsSelected(view.selectedObjectIds, false);
          }
        }
      ],
      [
        {
          getTitle: (context) => {
            const camera = context.view.camera;
            const isOrtho = camera.projectionType === xeokit.constants.OrthoProjectionType;
            return isOrtho ? "Perspective View" : "Orthographic View";
          },
          doAction: function (context) {
            const camera = context.view.camera;
            const isOrtho = camera.projectionType === xeokit.constants.OrthoProjectionType;
            camera.projectionType = isOrtho ? xeokit.constants.PerspectiveProjectionType : xeokit.constants.OrthoProjectionType;
          }
        }
      ]
    ]
  });

  // Create a ContextMenu for the canvas (i.e. when right-clicking on empty space)
  const objectContextMenu = new xeokit.ui.contextmenu.ContextMenu({
    items: [
      [
        {
          getTitle: (context) => {
            return context.viewObject.visible ? "Hide Object" : "Show Object";
          },
          doAction: function (context) {
            context.viewObject.visible = !context.viewObject.visible;
          }
        },
        {
          getTitle: context => {
            return context.viewObject.selected ? "Undo Select Object" : "Select Object";
          },
          doAction: function (context) {
            context.viewObject.selected = !context.viewObject.selected;
          }
        },
        // {
        //   getTitle: (context) => {
        //     return context.viewObject.highlighted ? "Undo Highlight Object" : "Highlight Object";
        //   },
        //   doAction: function (context) {
        //     context.viewObject.highlighted = !context.viewObject.highlighted;
        //   }
        // },
        {
          getTitle: (context) => {
            return context.viewObject.xrayed ? "Undo X-Ray Object" : "X-Ray Object";
          },
          doAction: function (context) {
            context.viewObject.xrayed = !context.viewObject.xrayed;
          }
        }
      ],
      [
        {
          getTitle: (context) => {
            return "Destroy Object";
          },
          doAction: function (context) {
            context.viewObject.sceneObject.destroy();
          }
        }
      ],
      [
        {
          getTitle: (context) => {
            const camera = context.viewObject.view.camera;
            const isOrtho = camera.projectionType === xeokit.constants.OrthoProjectionType;
            return isOrtho ? "Perspective View" : "Orthographic View";
          },
          doAction: function (context) {
            const camera = context.viewObject.view.camera;
            const isOrtho = camera.projectionType === xeokit.constants.OrthoProjectionType;
            camera.projectionType = isOrtho ? xeokit.constants.PerspectiveProjectionType : xeokit.constants.OrthoProjectionType;
          }
        }
      ]
      // [
      //   {
      //     getTitle: (context) => {
      //       return "Save BCF";
      //     },
      //     doAction: function (context) {
      //       const viewParamsRes = context.viewObject.view.toParams();
      //       if (viewParamsRes.ok) {
      //         const viewParams = viewParamsRes.value;
      //         console.log("Saved view parameters: " + JSON.stringify(viewParams, null, 2));
      //       } else {
      //         console.error("Failed to get view parameters: " + viewParamsRes.error);
      //       }
      //     }
      //   },
      //   {
      //     getTitle: (context) => {
      //       return "Restore BCF";
      //     },
      //     doAction: function (context) {
      //       const viewParams = {
      //         camera: {
      //           eye: [3, 12, 3],
      //           look: [0, 0, 0],
      //           up: [0, 0, 1]
      //         }
      //       };
      //       const viewParamsRes = context.viewObject.view.fromParams(viewParams);
      //       if (!viewParamsRes.ok) {
      //         console.error("Failed to restore view parameters: " + viewParamsRes.error);
      //       }
      //     }
      //   }
      // ]
    ],
    enabled: true
  });


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


      // Attach a mouse click listener to the View's canvas, and show our ContextMenu
      // when the user right-clicks on an object in the View.

      const tryPick = (view, e) => {

        const result = renderer.pick(view, {
          canvasPos: [e.offsetX, e.offsetY]
        });

        if (result) {
          if (result.ok) {
            const pickResult = result.value;
            if (pickResult && pickResult.viewObject) {
              objectContextMenu.context = {
                viewObject: pickResult.viewObject
              };
              objectContextMenu.show(e.clientX, e.clientY);
            } else {
              canvasContextMenu.context = {
                view: view
              };
              canvasContextMenu.show(e.clientX, e.clientY);
            }
          }
        } else {

          // TODO: Open empty canmvas menu

          console.log("Nothing picked");
        }
      };

      view1.htmlElement.addEventListener("contextmenu", e => tryPick(view1, e));
      view2.htmlElement.addEventListener("contextmenu", e => tryPick(view2, e));
      view3.htmlElement.addEventListener("contextmenu", e => tryPick(view3, e));

      demoHelper.finished();
    })
    .catch((err) => {
      console.error(err);
      throw err;
    });
});
