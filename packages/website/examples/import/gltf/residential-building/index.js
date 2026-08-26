// Loads and views a glTF 2.0 model of a residential building from a
// self-contained binary .glb (geometry, materials, and textures all
// embedded).
//
// glTF is one of the formats the loader registry recognises, but here we
// drive GLTFLoader directly: fetch the .glb bytes, create a SceneModel, and
// hand both to the loader. undefined + sRGB tonemap gives the model
// PBR shading, sun and shadows.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const GLB_URL = "../../../../models/ResidentialBuilding/gltf/model.glb";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [20, 15, 20],
      look: [0, 0, 0],
      up:   [0, 0, 1]
    },
    effects: {
      tonemap: {
        sRGBEncode: true
      }
    }
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading glTF…");
    const resp = await fetch(GLB_URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${GLB_URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    // glTF is Y-up, matching xeokit's default Y-up scene → identity basis.
    const sceneModelResult = scene.createModel({
      id: "residentialBuilding",
      coordinateSystem: {
        basis:  [1, 0, 0,  0, 1, 0,  0, 0, 1],
        origin: [0, 0, 0],
        units:  "meters",
        scaleToMeters: 1
      }
    });
    if (!sceneModelResult.ok) {
      throw new Error(sceneModelResult.error);
    }
    const sceneModel = sceneModelResult.value;

    await new xeokit.formats.gltf.GLTFLoader().load({ fileData, sceneModel });

    console.log(
      `[glTF] loaded ${Object.keys(sceneModel.objects).length} objects, ` +
      `${Object.keys(sceneModel.meshes).length} meshes, ` +
      `${Object.keys(sceneModel.geometries).length} geometries, ` +
      `${Object.keys(sceneModel.textures).length} textures`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) {
      studio.viewManager.fitToAabb(view, aabb);
    }

    if (status) status.style.display = "none";
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load glTF: ${err.message || err}`);
    console.error(err);
  }
});
