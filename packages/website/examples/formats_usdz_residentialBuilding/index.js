// Loads and views a Pixar USDZ file.
//
// USDZ is a ZIP package wrapping a binary USD "Crate" layer (.usdc); USDZLoader
// unpacks it and decodes the crate with the tinyusdz wasm reader, then builds a
// SceneModel. The sample (models/ResidentialBuilding/usdz/model.usdz) is a
// Sketchfab export — ~140 meshes / ~146k triangles with UsdPreviewSurface
// materials.
//
// Browser only: the tinyusdz wasm is web-only, and it is fetched lazily from a
// CDN on first load, so this example needs network access. The studio bundle
// must include the USDZ loader — rebuild it with `npm run website-build-xeokit-lib`
// if USDZLoader is missing from `xeokit.formats.usdz`.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const USDZ_URL = "../../models/ResidentialBuilding/usdz/model.usdz";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [20, 15, 20],
      look: [0, 0, 0],
      up:   [0, 0, 1]
    }
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading USDZ…");
    const resp = await fetch(USDZ_URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${USDZ_URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    // USD is Y-up; this Sketchfab export sits Y-up like the FBX sample, so we
    // use the same basis to orient it into the Z-up scene.
    const sceneModelResult = scene.createModel({
      id: "usdzSample",
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

    await new xeokit.formats.usdz.USDZLoader().load({ fileData, sceneModel });

    console.log(
      `[USDZ] loaded ${Object.keys(sceneModel.objects).length} objects, ` +
      `${Object.keys(sceneModel.meshes).length} meshes, ` +
      `${Object.keys(sceneModel.geometries).length} geometries`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) {
      studio.viewManager.fitToAabb(view, aabb);
    }

    if (status) status.style.display = "none";
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load USDZ: ${err.message || err}`);
    console.error(err);
  }
});
