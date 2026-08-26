// Loads and views a binary Autodesk FBX plant model.
//
// FBX is not one of the formats the loader registry recognises, so we drive
// FBXLoader directly: fetch the .fbx bytes, create a SceneModel, and hand both
// to the loader.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const FBX_URL = "../../../../models/E3D_Plant/fbx/model.fbx";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      "eye": [
        -300.45928353964246,
        258.25925259779626,
        124.00350940239844
      ],
      "look": [
        -302.12662024198926,
        301.5614529151791,
        106.08332812798437
      ],
      "up": [
        -0.014703546021141807,
        0.3818640120771069,
        0.9241015539510684
      ]
    }
  });



  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading FBX…");
    const resp = await fetch(FBX_URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${FBX_URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    // FBX is Y-up here, matching xeokit's default Y-up scene → identity basis.
    const sceneModelResult = scene.createModel({
      id: "fbxSample",
      coordinateSystem: {
        basis:  [1, 0, 0,  0, 0, 1,  0, 1, 0],
        origin: [0, 0, 0],
        units:  "meters",
        scaleToMeters: 1
      }
    });
    if (!sceneModelResult.ok) {
      throw new Error(sceneModelResult.error);
    }
    const sceneModel = sceneModelResult.value;

    await new xeokit.formats.fbx.FBXLoader().load({ fileData, sceneModel });

    console.log(
      `[FBX] loaded ${Object.keys(sceneModel.objects).length} objects, ` +
      `${Object.keys(sceneModel.meshes).length} meshes, ` +
      `${Object.keys(sceneModel.geometries).length} geometries`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) {
      studio.viewManager.fitToAabb(view, aabb);
    }

    if (status) status.style.display = "none";
    await studio.openInfoPanelFromMeta();
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load FBX: ${err.message || err}`);
    console.error(err);
  }
});
