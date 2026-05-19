// Import the xeokit SDK bundle used by this example. This bundle provides
// the helper, loader, scene, data, and rendering APIs required by the
// sample.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the rendering context,
// constructs the Scene and Data subsystems, and provides utilities for
// setting up the demo.
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  // Access the Scene and Data instances created by the Studio. The Scene
  // manages renderable model content, while the Data subsystem manages
  // semantic and metadata content associated with the model.
  const { scene, data } = studio;

  // Create a View and configure its initial camera. The camera is positioned
  // to frame the model after loading, and the perspective far plane is
  // extended to accommodate large point cloud extents.
  const view = studio.viewManager.createView({
    camera: {
      eye: [-11.88, 39.43, 12.95],
      look: [2.34, 20.84, 1.71],
      up: [0.26, -0.34, 0.90],
      perspectiveProjection: {
        far: 10000000
      }
    },

    // Configure point rendering for the point cloud. These settings control
    // point size, shape, perspective scaling, and the intensity filtering
    // range used when rendering LAS or LAZ data.
    pointsMaterial: {
      pointSize: 2,
      roundPoints: true,
      perspectivePoints: true,
      minPerspectivePointSize: 1,
      maxPerspectivePointSize: 5,
      filterIntensity: false,
      minIntensity: 0,
      maxIntensity: 100
    }
  });

  // Create a SceneModel to hold renderable model content. Geometry and
  // appearance data loaded from the LAZ file will be stored in this model.
  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  // Validate that the SceneModel was created successfully. If creation
  // fails, log the error.
  if (sceneModelResult.ok === false) {
    console.error(`Error creating SceneModel: ${sceneModelResult.error}`);
  }

  const sceneModel = sceneModelResult.value;

  // Create a DataModel to hold semantic model data. Metadata, object
  // relationships, and higher-level object meaning are stored here.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  // Validate that the DataModel was created successfully. If creation
  // fails, log the error.
  if (dataModelResult.ok === false) {
    console.error(`Error creating DataModel: ${dataModelResult.error}`);
  }

  const dataModel = dataModelResult.value;

  // Create a LASLoader to load LAS or LAZ point cloud data into the
  // SceneModel and DataModel.
  const lasLoader = new xeokit.formats.las.LASLoader();

  // Fetch the LAZ file, decode it to an ArrayBuffer, and then load it into
  // the SceneModel and DataModel.
  fetch("../../models/Nalls-Pumpkin-Hill/laz/model.laz").then(response => {

    response
        .arrayBuffer()
        .then(fileData => {

          // Load the point cloud into the scene and semantic data models.
          // This creates renderable point cloud content in the Scene and
          // corresponding semantic objects in the Data subsystem.
          lasLoader.load({
            fileData,
            sceneModel,
            dataModel
          }).then(() => {

            // Signal that loading has completed. At this point, the Scene and
            // SceneModel contain the rendered point cloud, while the Data and
            // DataModel contain the corresponding semantic representation.
            studio.finished();

          }).catch(message => {

            // Log any errors that occur while loading the LAS or LAZ data.
            console.error(`[LASLoader.load] Error loading LAS: ${message}`);
          });
        });
  });
});