// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {scene, data} = demoHelper;

  // Create loaders

  const mtlLoader = new xeokit.formats.mtl.MTLLoader();
  const objLoader = new xeokit.formats.obj.OBJLoader();

  // Arrange the View's Camera within our +Z "up" coordinate system

  demoHelper.createView({
      camera: {
        // projection: "perspective",
        eye: [3.27, 3.91, 2.39],
        look: [0, 0, 0],
        up: [-0.18, -0.28, 0.93]
      }
  });

  const view2 = demoHelper.createView({
    camera: {
      projectionType: xeokit.constants.OrthoProjectionType,
      eye: [3.27, 3.91, 2.39],
      look: [0, 0, 0],
      up: [-0.18, -0.28, 0.93],
      orthoProjection:{
        scale:100.0
      }
    }
  });

  //
  // view.camera.eye = [3.27, 3.91, 2.39];
  // view.camera.look = [0, 0, 0];
  // view.camera.up = [-0.18, -0.28, 0.93];

  // Create a SceneModel to hold our model's geometry and materials

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

  // Create a DataModel to hold semantic data for our model

  const dataModelRes = data.createModel({
    id: "demoModel"
  });

  if (dataModelRes.ok === false) {
    console.error(`Error creating DataModel: ${dataModelRes.error}`);
    return;
  }

  const dataModel = dataModelRes.value;

  // Load MTL first, then OBJ

  Promise.all([
    fetch("../../models/SportsCar/obj/model.obj").then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch OBJ: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }),
    fetch("../../models/SportsCar/obj/model.mtl").then((response) => {
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

      const exploder = new xeokit.demo.SceneModelExploder({
        scene,
        sceneModel,
        aabb3Index: demoHelper.aabb3Index
      });

      exploder.rebuild();

      view2.setObjectsXRayed(view2.objectIds, true);

      view2.setObjectsXRayed(view2.objectIds.slice(30,40), false);

      demoHelper.finished();
    })
    .catch((message) => {
      console.error(`Error loading OBJ/MTL: ${message}`);
    });
});
