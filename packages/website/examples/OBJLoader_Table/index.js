// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene} = demoHelper;

  // Create loaders

  const mtlLoader = new xeokit.formats.mtl.MTLLoader();
  const objLoader = new xeokit.formats.obj.OBJLoader();

  // Arrange the View's Camera within our +Z "up" coordinate system

  demoHelper.createView({
    camera: {
      eye: [7, -16, 0],
      look: [0, 0, -5],
      up: [0, 0, 1]
    }
  });

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

  // Load MTL first, then OBJ

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
      return mtlLoader.load({
        fileData: mtlFileData,
        sceneModel
      }).then(() => {
        return  objFileData;
      });
    })
    .then((objFileData) => {
      return objLoader.load({
        fileData: objFileData,
        sceneModel
      });
    })
    .then(() => {
      demoHelper.finished();
    })
    .catch((message) => {
      console.error(`Error loading OBJ/MTL: ${message}`);
    });
});
