// Import the xeokit SDK bundle used by this example.
// Includes the rendering engine, format loaders, and demo helpers.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

async function main() {
  const demoHelper = new xeokit.demo.DemoHelper({});
  await demoHelper.init();

  const { scene, data } = demoHelper;

  const camera = {
    eye: [-16.383975302039776, -20.90090956270501, 34.64315481555981],
    look: [11.596502984703388, -0.7479630905370414, 10.83197660816235],
    up: [0.4610748523588048, 0.33208926104069153, 0.8228770887707068]
  };

  const view1 = demoHelper.createView({
    camera,
    autoLayers: false,
    layers: [
      {
        id: "arc",
        visible: true,
        autoDestroy: false
      }
    ]
  });

  const view2 = demoHelper.createView({
    camera,
    autoLayers: false,
    layers: [
      {
        id: "lft",
        visible: true,
        autoDestroy: false
      },
      {
        id: "san",
        visible: true,
        autoDestroy: false
      }
    ]
  });

  const dataModelRes = data.createModel({ id: "demoModel" });
  if (!dataModelRes.ok) {
    throw new Error(`Failed to create DataModel: ${dataModelRes.error}`);
  }
  const dataModel = dataModelRes.value;

  const sceneModelRes = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [ // Right-handed Y-up with Z forward
        1, 0, 0,
        0, 1, 0,
        0, 0, -1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  if (!sceneModelRes.ok) {
    throw new Error(`Failed to create SceneModel: ${sceneModelRes.error}`);
  }
  const sceneModel = sceneModelRes.value;

  // ------------------------------------------------------------------------------------------------
  // FM_ARC
  // ------------------------------------------------------------------------------------------------

  try {
  await demoHelper.loadModel({
    src: "../../models/FM_ARC/datamodel/model.json",
    format: "datamodel",
    dataModel
  });

  // await demoHelper.loadModel(
  //   {
  //     src: "../../models/FM_ARC/xgf/model.xgf",
  //     format: "xgf",
  //     sceneModel
  //   },
  //   {
  //     layerId: "arc" // This model will be available in view1, but not view2
  //   }
  // );
  } catch (err) {
    console.error("Error loading FM_ARC model:", err);
  }

  // ------------------------------------------------------------------------------------------------
  // FM_HGZ (optional)
  // ------------------------------------------------------------------------------------------------

  try {
    // await demoHelper.loadModel({
    //   src: "../../models/FM_HGZ/metamodel/model.json",
    //   format: "metamodel",
    //   dataModel
    // });

    // await demoHelper.loadModel({
    //   src: "../../models/FM_HGZ/gltf/model.glb",
    //   format: "gltf",
    //   sceneModel
    // });
  } catch (err) {
    console.error("Error loading FM_HGZ model:", err);
  }

  // ------------------------------------------------------------------------------------------------
  // FM_LFT
  // ------------------------------------------------------------------------------------------------

  try {
    await demoHelper.loadModel({
      modelId: "FM_LFT",
      format: "datamodel",
      dataModel
    });

    await demoHelper.loadModel({modelId: "FM_LFT", format: "xgf"}, {layerId: "lft" });



  } catch (err) {
    console.error("Error loading FM_LFT model:", err);
  }

  // ------------------------------------------------------------------------------------------------
  // FM_SAN (optional)
  // ------------------------------------------------------------------------------------------------

  try {

    await demoHelper.loadModel({modelId: "FM_SAN", format: "metamodel"});

   await demoHelper.loadModel({modelId: "IfcOpenHouse4", format: "xgf"}, {});

    await demoHelper.loadModel({modelId: "Duplex", format: "xgf"}, {});

//    await demoHelper.loadModel({modelId: "IfcOpenHouse4", format: "datamodel", dataModel}, {});




  } catch (err) {
    console.error("Error loading FM_SAN model:", err);
  }

  // Optional fallback coloring
  // applyFallbackColors(dataModel, sceneModel, arcColorMap, arcNameColorMap);

  // Optional exploder
  // const exploder = new xeokit.demo.SceneModelExploder({
  //   scene,
  //   sceneModel,
  //   aabb3Index: demoHelper.aabb3Index
  // });
  // exploder.rebuild();

  demoHelper.finished();
}

main().catch((err) => {
  console.error("Error initializing demo:", err);
});
