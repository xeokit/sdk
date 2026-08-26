import {systems as studioSystems} from "../../../../libs/studio/dist/index.js";
// Attach procedural IFC materials to an already-loaded Duplex
// SceneModel.
//
// Loads the Duplex SceneModel + DataModel, then calls
// xeokit.studio.attachSceneModelMaterials to walk every SceneObject in
// the SceneModel, look up its matching DataObject by id, read the
// IFC type, and bind a procedurally-painted PBR material to all of
// the object's SceneMeshes — IfcWall → paintBrick, IfcSlab →
// paintCeramicTile, IfcWindow → paintGlass, etc. The materials and
// their three textures are added to the same SceneModel.

import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const MODEL_BASE = "../../../../models/Duplex";

async function main() {

  const studio = new xeokit.studio.Studio({});
  await studio.init();

  const { scene, data } = studio;

  // ── DataModel + SceneModel populated from the Duplex assets.

  const dataModelResult = data.createModel({ id: "duplex" });
  if (!dataModelResult.ok) throw new Error(dataModelResult.error);
  const dataModel = dataModelResult.value;

  const sceneModelResult = scene.createModel({
    id: "duplex",
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
  if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
  const sceneModel = sceneModelResult.value;

  await studio.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/datamodel/model.json`,
    format: "datamodel",
    dataModel
  });

  await studio.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/xgf/model.xgf`,
    format: "xgf",
    sceneModel
  });

  // ── Attach generation IFC materials in place. Reads each
  // SceneObject's IFC type from the DataModel and binds the
  // matching painter's textures + SceneMaterial to that object's
  // SceneMeshes. Materials and textures are added to the same
  // SceneModel.
  // applyIFCMaterials is async — texture generation streams
  // through the progress reporter. Await the result so the
  // SDKResult check sees a resolved value (without await, the
  // returned Promise's `.ok` is undefined and the throw fires
  // every time, killing the createView call that follows).
  const attachResult = await studioSystems.applyIFCMaterials({
    sceneModel,
    dataModel,
    textureSize: 256
  });
  if (!attachResult.ok) throw new Error(attachResult.error);


  // ── View, lighting, HDR IBL.

  const view = studio.viewManager.createView({
    camera: {
      eye:  [31.38663988418555, 32.115413398051004, 14.796097980600416],
      look: [0.6121272273206806, 6.666971960818746, 2.5235511335317735],
      up:   [-0.2263867800274616, -0.18720656464184895, 0.9558779880213767]
    },
    effects: {
      tonemap: { sRGBEncode: true }
    }
  });

  studio.openInfoPanelFromMeta();
  studio.finished();
}

main().catch(err => {
  console.error("[AttachSceneModelMaterials_Duplex]", err);
});
