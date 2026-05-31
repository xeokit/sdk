// Import the xeokit SDK bundle used by these examples.
// It includes the demo helper, renderer, scene/data APIs, and format loaders,
// so this file can focus on the OBJ + MTL loading flow.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene, data} = studio;

  // Create separate loaders for materials and geometry.
  // OBJ files usually depend on a .mtl file, so loading materials first helps ensure
  // the model is rendered with the expected look when geometry is loaded.

  const mtlLoader = new xeokit.formats.mtl.MTLLoader();
  const objLoader = new xeokit.formats.obj.OBJLoader();

  // Configure the first camera in a +Z-up coordinate system.
  // This gives a clear perspective framing and makes world orientation explicit,
  // which is helpful when adapting to different asset up-axis conventions.

  studio.viewManager.createView({
      camera: {
        // Keep perspective projection for the main view.
        // It preserves depth cues and keeps setup simple.
        eye: [3.27, 3.91, 2.39],
        look: [0, 0, 0],
        up: [-0.18, -0.28, 0.93]
      }
  });

  const view2 = studio.viewManager.createView({
    camera: {
      eye: [3.27, 3.91, 2.39],
      look: [0, 0, 0],
      up: [-0.18, -0.28, 0.93]
    }
  });


  // Create a SceneModel to hold renderable model content.
  // It stores geometry and materials, and its coordinate system settings define
  // basis, origin, and units for consistent model interpretation.

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

  if (sceneModelRes.ok === false) {
    throw new Error("Failed to create SceneModel: " + sceneModelRes.error);
  }

  const sceneModel = sceneModelRes.value;

  // Create a DataModel to hold semantic and logical data.
  // This supports workflows like object inspection and metadata-based filtering
  // without coupling that logic to render-only structures.

  const dataModelRes = data.createModel({
    id: "demoModel"
  });

  if (dataModelRes.ok === false) {
    console.error(`Error creating DataModel: ${dataModelRes.error}`);
    return;
  }

  const dataModel = dataModelRes.value;

  // Fetch both files, then load MTL before OBJ.
  // Files are fetched in parallel for speed, but materials are applied first so
  // OBJ meshes can bind the correct material definitions right away.

  Promise.all([
    fetch("../../models/SportsCar/obj/model.obj").then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch OBJ: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }),
    fetch("../../models/SportsCar/mtl/model.mtl").then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch MTL: ${response.status} ${response.statusText}`);
      }
      return response.text();
    })
  ])
    .then(([objFileData, mtlFileData]) => {
      return mtlLoader.load({
        fileData: mtlFileData,
        sceneModel
      }).then(() => {
        return {
          objFileData
        };
      });
    })
    .then(({objFileData}) => {
      return objLoader.load({
        fileData: objFileData,
        sceneModel,
        dataModel
      });
    })
    .then(() => {

      // Add a simple post-load inspection workflow.
      // Rebuild exploder bounds and apply x-ray styling in the second view to
      // highlight selected objects after loading.

      const exploder = new xeokit.presentations.exploder.SceneModelExploder({
        scene,
        sceneModel,
        collisionIndex: studio.picking.collisionIndex
      });

      exploder.rebuild();

      view2.setObjectsXRayed(view2.objectIds, true);

      view2.setObjectsXRayed(view2.objectIds.slice(30,40), false);

      studio.openInfoPanelFromMeta();
      studio.finished();
    })
    .catch((message) => {
      console.error(`Error loading OBJ/MTL: ${message}`);
    });
});
