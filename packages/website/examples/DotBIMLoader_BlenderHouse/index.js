// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({
  maxViews: 4
});

demoHelper.init().then(() => {

  const {scene, data} = demoHelper;

  demoHelper.createView({
    id: "demoView",
    camera: {
      projection: "perspective",
      eye: [11.276311451067942, 16.914467176601914, 7.399026975905038],
      look: [0, 0, 0],
      up:[-0.18971864040782152, -0.28457796061173224, 0.9396926209223285]
    }
  });

  demoHelper.createView({
    id: "demoView2",
    camera: {
      projection: "perspective",
      eye: [3.96,7.32, 2.43],
      look: [3.96,7.26,2.41],
      up:[-0.01,-0.34,0.93]
    }
  });

  const view3=demoHelper.createView({
    id: "demoView3",
    camera: {
      projection: "perspective",
      "eye": [4.774533582430622,-4.957123635133675,2.0657471848880826],
      "look": [4.924154577356121,0.6026154777203292,2.2492017282402097],
      "up": [-0.0008868734758493616,-0.032955167483889054,0.9994564374656588],
    }
  });

  demoHelper.createView({
    id: "demoView4",
    camera: {
      projectionType: xeokit.constants.OrthoProjectionType,
      "eye": [-8.455856458530768,4.313350852098562,4.042693533298635],
      "look": [0.5972351048617472,4.466713652396827,3.550652052021054],
      "up": [0.05425501522042314,0.0009191005846136308,0.9985266889660721],
      orthoProjection:{
        scale:1000
      }
    },
  });

// Create a SceneModel to hold our model's geometry and materials

  const sceneModelRes = scene.createModel({
    id: "demoModel",

    // Specify that the model's coordinates are in a right-handed system with +Z "up", and that units are in
    // meters. This will ensure that the model is oriented correctly in the View, and that any real-world
    // sizes in the model are correct. We actually don't need to specify this here since these are the
    // default settings for the coordinate system, but we'll specify it here for demonstration purposes.
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 0, 1, // Up
        0, 1, 0  // Forward
      ],
      origin: [0,0,0],
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

  } else {

    const dataModel = dataModelRes.value;

    // Create a DotBIMLoader to load .BIM files

    const dotBIMLoader = new xeokit.formats.dotbim.DotBIMLoader();

    // Use the DotBIMLoader to load an IFC model from a .BIM file into our SceneModel and DataModel

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

              // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
              // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
              // will have a corresponding DataObject with the same ID, to show semantic meaning.
              // The View will contain a ViewObject corresponding to each SceneObject, through which the
              // appearance of the object can be controlled in the View.

              view3.setObjectsXRayed(view3.objectIds, true);

              demoHelper.finished();

              // const exploder = new xeokit.demo.SceneModelExploder({
              //   scene,
              //   sceneModel,
              //   aabb3Index: demoHelper.aabb3Index
              // });
              //
              // exploder.rebuild();

            }).catch(message => {
              console.error(`Error loading .BIM: ${message}`);
            });
          });
      });
  }
});
