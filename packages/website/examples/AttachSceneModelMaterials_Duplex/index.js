// Attach procedural IFC materials to an already-loaded Duplex
// SceneModel.
//
// Loads the Duplex SceneModel + DataModel, then calls
// xeokit.demo.attachSceneModelMaterials to walk every SceneObject in
// the SceneModel, look up its matching DataObject by id, read the
// IFC type, and bind a procedurally-painted PBR material to all of
// the object's SceneMeshes — IfcWall → paintBrick, IfcSlab →
// paintCeramicTile, IfcWindow → paintGlass, etc. The materials and
// their three textures are added to the same SceneModel.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const MODEL_BASE = "../../models/Duplex";

async function main() {

  const demoHelper = new xeokit.demo.DemoHelper({});
  await demoHelper.init();

  const { scene, data } = demoHelper;

  // ── DataModel + SceneModel populated from the Duplex assets.

  const dataModelResult = data.createModel({ id: "duplex" });
  if (!dataModelResult.ok) throw new Error(dataModelResult.error);
  const dataModel = dataModelResult.value;

  const sceneModelResult = scene.createModel({
    id: "duplex",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
  const sceneModel = sceneModelResult.value;

  await demoHelper.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/datamodel/model.json`,
    format: "datamodel",
    dataModel
  });

  await demoHelper.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/xgf/model.xgf`,
    format: "xgf",
    sceneModel
  });

  // ── Attach procgen IFC materials in place. Reads each
  // SceneObject's IFC type from the DataModel and binds the
  // matching painter's textures + SceneMaterial to that object's
  // SceneMeshes. Materials and textures are added to the same
  // SceneModel.
  const attachResult = xeokit.demo.applyIFCMaterials.applyIFCMaterials({
    sceneModel,
    dataModel,
    textureSize: 256
  });
  if (!attachResult.ok) throw new Error(attachResult.error);

  sceneModel.finalize();

  // ── View, lighting, HDR IBL.

  const view = demoHelper.createView({
    camera: {
      eye:  [31.38663988418555, 32.115413398051004, 14.796097980600416],
      look: [0.6121272273206806, 6.666971960818746, 2.5235511335317735],
      up:   [-0.2263867800274616, -0.18720656464184895, 0.9558779880213767]
    },
    renderMode: xeokit.constants.RealisticRender,
    tonemap: { sRGBEncode: true }
  });

  demoHelper.finished();
}

main().catch(err => {
  console.error("[AttachSceneModelMaterials_Duplex]", err);
});
