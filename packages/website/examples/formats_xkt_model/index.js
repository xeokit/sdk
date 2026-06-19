// Loads and views a model from xeokit's native XKT v12 binary (uncompressed
// container). XKTLoader reconstructs the SceneModel geometry — pooled,
// 16-bit-quantised, with instanced geometry — and maps the embedded BIM
// metadata into a DataModel. The SceneModel and DataModel share object ids, so
// each rendered object is the same entity as its metadata.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const XKT_URL = "../../models/XKTModel/xkt/model.xkt";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const {scene, data} = studio;

  const view = studio.viewManager.createView({
    // XKT BIM models are authored Z-up.
    camera: {eye: [-30, -30, 20], look: [0, 0, 0], up: [0, 0, 1]},
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading XKT…");
    const resp = await fetch(XKT_URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${XKT_URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    // Scene and data models share the same id, so their objects line up.
    const sceneModel = scene.createModel({id: "xktModel",
      coordinateSystem: {
        basis: [
          1, 0, 0, // Right (+X)
          0, 1, 0, // Up (+Y)
          0, 0, -1 // Forward (-Z)
        ],
        origin: [0, 0, 0],
        units: "meters"
      }
    }).value;
    const dataModel = data.createModel({id: "xktModel"}).value;

    await new xeokit.formats.xkt.XKTLoader().load({fileData, sceneModel, dataModel});

    console.log(
      `[XKT] loaded ${Object.keys(sceneModel.objects).length} objects, ` +
      `${Object.keys(sceneModel.meshes).length} meshes, ` +
      `${Object.keys(sceneModel.geometries).length} geometries; ` +
      `${Object.keys(dataModel.objects).length} data objects`,
    );

    // The spatial index may not have the freshly-created objects on the very
    // next tick, so retry the fit for up to ~1s until a valid scene AABB exists.
    let fitTries = 0;
    const fitToScene = () => {
      const aabb = studio.picking.collisionIndex.getSceneAABB();
      if (aabb && Number.isFinite(aabb[0]) && aabb[3] > aabb[0]) {
        studio.viewManager.fitToAabb(view, aabb);
        return;
      }
      if (fitTries++ < 20) setTimeout(fitToScene, 50);
    };
    fitToScene();

    setStatus(
      `XKT v12 — ${Object.keys(sceneModel.objects).length} objects, ` +
      `${Object.keys(dataModel.objects).length} metadata objects.`,
    );
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load XKT: ${err.message || err}`);
    console.error(err);
  }
});
