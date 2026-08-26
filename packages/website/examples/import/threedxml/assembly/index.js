// Loads and views a Dassault Systèmes 3DXML assembly — a SolidWorks-exported
// tooling assembly (3DXML 4.2). 3DXML is a ZIP of XML: a Manifest, a product-
// structure document (the assembly tree), and tessellated representation files.
//
// 3DXML is one of the formats the loader registry recognises, but here we drive
// ThreeDXMLLoader directly: fetch the .3dxml bytes, create a SceneModel, and hand
// both to the loader. It unzips the package, walks the product structure (baking
// each instance's RelativeMatrix into its mesh transform), and emits one geometry
// per representation (reused across instances), one mesh per instance, one object
// per instance.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const URL = "../../../../models/3DPreview/threedxml/model.3dxml";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [80, 80, 80],
      look: [0, 0, 0],
      up:   [0, 0, 1]
    }
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading 3DXML…");
    const resp = await fetch(URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    // SolidWorks 3DXML is authored Y-up in millimetres; rotate Y → the SDK
    // scene's Z-up so the assembly stands upright (basis columns Right/Up/Forward).
    const sceneModelResult = scene.createModel({
      id: "3DPreview",
      coordinateSystem: {
        basis:  [1, 0, 0,  0, 0, 1,  0, 1, 0],
        origin: [0, 0, 0],
        units:  "meters"
      }
    });
    if (!sceneModelResult.ok) {
      throw new Error(sceneModelResult.error);
    }
    const sceneModel = sceneModelResult.value;

    await new xeokit.formats.threedxml.ThreeDXMLLoader().load({ fileData, sceneModel });

    console.log(
      `[3DXML] loaded ${Object.keys(sceneModel.objects).length} objects, ` +
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
    setStatus(`Failed to load 3DXML: ${err.message || err}`);
    console.error(err);
  }
});
