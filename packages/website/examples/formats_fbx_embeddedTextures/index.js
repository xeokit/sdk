// Loads and views a binary Autodesk FBX file whose texture is embedded in the
// file itself.
//
// FBX can carry texture images inline (as a `Video` node's `Content` bytes)
// rather than referencing external files. FBXLoader decodes those bytes,
// creates a SceneModel texture, and wires it to each material's colour slot —
// no extra fetches, the whole model is self-contained.
//
// The sample (models/FBX_Sample/fbx/model.fbx) is four cubes that share one
// geometry and one embedded checkerboard texture; each cube's own material
// colour tints the shared texture.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const FBX_URL = "../../models/FBX_Sample/fbx/model.fbx";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [5, 4, 5],
      look: [0, 0.5, 0],
      up:   [0, 1, 0]
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
      id: "fbxTextured",
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
      `${Object.keys(sceneModel.geometries).length} geometries, ` +
      `${Object.keys(sceneModel.textures).length} embedded textures`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) {
      studio.viewManager.fitToAabb(view, aabb);
    }

    if (status) status.style.display = "none";
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load FBX: ${err.message || err}`);
    console.error(err);
  }
});
