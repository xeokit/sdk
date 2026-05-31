// Import the xeokit SDK bundle. This bundle provides the demo helper
// along with scene, data, loader, and rendering APIs used in this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper with support for up to four views. This helper
// initializes the shared rendering context and provides utilities for
// configuring and managing the demo.
const studio = new xeokit.studio.Studio({
  maxViews: 4
});

studio.init().then(() => {

  // Access the Scene and Data subsystems. The Scene manages renderable
  // content, while the Data subsystem manages semantic structure and
  // metadata.
  const { scene, data } = studio;

  // Create a perspective view with a camera positioned to look toward
  // the origin, providing an overview of the model.
  studio.viewManager.createView({
    id: "demoView",
    camera: {
      projection: "perspective",
      eye: [11.28, 16.91, 7.40],
      look: [0, 0, 0],
      up: [-0.19, -0.28, 0.94]
    }
  });

  // Create a second perspective view with a closer, more focused framing.
  studio.viewManager.createView({
    id: "demoView2",
    camera: {
      projection: "perspective",
      eye: [3.96, 7.32, 2.43],
      look: [3.96, 7.26, 2.41],
      up: [-0.01, -0.34, 0.93]
    }
  });

  // Create a third perspective view and retain a reference so that its
  // rendering state can be modified after loading.
  const view3 = studio.viewManager.createView({
    id: "demoView3",
    camera: {
      projection: "perspective",
      eye: [4.77, -4.96, 2.07],
      look: [4.92, 0.60, 2.25],
      up: [-0.00, -0.03, 1.00]
    }
  });

  // Create a fourth view using an orthographic projection. The projection
  // scale is configured to provide a wider, distortion-free view of the
  // model.
  studio.viewManager.createView({
    id: "demoView4",
    camera: {
      projectionType: xeokit.base.constants.OrthoProjectionType,
      eye: [-8.46, 4.31, 4.04],
      look: [0.60, 4.47, 3.55],
      up: [0.05, 0.00, 1.00],
      orthoProjection: {
        scale: 1000
      }
    }
  });

  // Create a SceneModel to hold renderable geometry and material state.
  // The coordinate system is defined explicitly to ensure consistent
  // interpretation of axes and units.
  const sceneModelRes = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 0, 1, // Up
        0, 1, 0  // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  // Ensure that the SceneModel was created successfully before continuing.
  if (sceneModelRes.ok === false) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // Create a DataModel to hold semantic data such as object types,
  // relationships, and metadata.
  const dataModelRes = data.createModel({
    id: "demoModel"
  });

  if (dataModelRes.ok === false) {
    console.error(`Error creating DataModel: ${dataModelRes.error}`);
  } else {

    const dataModel = dataModelRes.value;

    // Create a DotBIMLoader to load .BIM model data into both the
    // SceneModel and DataModel.
    const dotBIMLoader = new xeokit.formats.dotbim.DotBIMLoader();

    // Fetch the .BIM file, parse it as JSON, and load it into the
    // renderable and semantic models.
    fetch("../../models/BlenderHouse/dotbim/model.bim")
        .then(response => {
          response
              .json()
              .then(fileData => {

                dotBIMLoader.load({
                  fileData,
                  sceneModel,
                  dataModel
                }).then(() => {

                  // Apply an X-ray effect to all objects in the third view,
                  // making them semi-transparent for inspection.
                  view3.setObjectsXRayed(view3.objectIds, true);

                  // Signal that loading and setup have completed.
                  studio.openInfoPanelFromMeta();
                  studio.finished();

                  // Optional: enable exploded view visualization using the
                  // SceneModelExploder utility.
                  // const exploder = new xeokit.studio.SceneModelExploder({
                  //   scene,
                  //   sceneModel,
                  //   collisionIndex: studio.picking.collisionIndex
                  // });
                  // exploder.rebuild();

                }).catch(message => {
                  console.error(`Error loading .BIM: ${message}`);
                });
              });
        });
  }
});