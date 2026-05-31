// Import the xeokit SDK bundle used by these examples. This bundle provides
// helper utilities along with the loader and rendering APIs required to
// construct and display models.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the rendering context,
// constructs the Scene, and provides utilities for creating Views and
// managing the demo lifecycle.
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  // Access the Scene instance created by the Studio. The Scene
  // manages models and rendering state.
  const { scene } = studio;

  // Create separate loaders for materials and geometry. The MTL loader parses
  // material definitions, while the OBJ loader parses mesh geometry. Loading
  // materials first ensures that meshes are assigned the correct materials
  // as soon as they are created.
  const mtlLoader = new xeokit.formats.mtl.MTLLoader();
  const objLoader = new xeokit.formats.obj.OBJLoader();

  // Create a View and configure its initial camera in a +Z-up coordinate
  // system. The camera is positioned to provide a clear initial framing of
  // the table model.
  studio.viewManager.createView({
    camera: {
      eye: [7, -16, 0],
      look: [0, 0, -5],
      up: [0, 0, 1]
    }
  });

  // Create a SceneModel to hold the renderable model content. The coordinate
  // system is defined explicitly to ensure consistent interpretation of the
  // model data, including axis orientation and unit scaling.
  const sceneModelRes = scene.createModel({
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

  // Validate that the SceneModel was created successfully. If creation fails,
  // throw an error describing the failure.
  if (sceneModelRes.ok === false) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // Fetch the OBJ and MTL files in parallel. Once both files are available,
  // load the MTL file first so that material definitions are ready before
  // loading the OBJ geometry.
  Promise.all([
    fetch("../../models/Table/obj/model.obj").then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch OBJ: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }),
    fetch("../../models/Table/mtl/model.mtl").then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch MTL: ${response.status} ${response.statusText}`);
      }
      return response.text();
    })
  ])
      .then(([objFileData, mtlFileData]) => {

        // Load material definitions into the SceneModel. Once materials are
        // applied, proceed to load the OBJ geometry.
        return mtlLoader.load({
          fileData: mtlFileData,
          sceneModel
        }).then(() => {
          return objFileData;
        });
      })
      .then((objFileData) => {

        // Load OBJ geometry into the SceneModel. Geometry will automatically
        // reference the previously loaded materials where applicable.
        return objLoader.load({
          fileData: objFileData,
          sceneModel
        });
      })
      .then(() => {

        // Signal that loading has completed. This typically hides any loading
        // indicators managed by the Studio.
        studio.openInfoPanelFromMeta();
        studio.finished();
      })
      .catch((message) => {

        // Log any errors that occur during loading of the OBJ or MTL files.
        console.error(`Error loading OBJ/MTL: ${message}`);
      });
});