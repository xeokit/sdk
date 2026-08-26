// Round-trips a model through xeokit's native XKT v12 binary: import an XKT
// into an offscreen SceneModel + DataModel, export those straight back to XKT
// with XKTExporter, then re-import the exported bytes into the rendered scene.
// The displayed model is the re-imported copy, so what you see is the result of
// a full XKTLoader → XKTExporter → XKTLoader cycle.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const XKT_URL = "../../../../models/XKTModel/xkt/model.xkt";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const {scene, data} = studio;

  const view = studio.viewManager.createView({
    camera: {eye: [-30, -30, 20], look: [0, 0, 0], up: [0, 0, 1]},
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading source XKT…");
    const resp = await fetch(XKT_URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${XKT_URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    // 1. Import into an offscreen SceneModel + DataModel (not rendered).
    const srcScene = new xeokit.model.scene.Scene();
    const srcData = new xeokit.model.data.Data();
    const srcModel = srcScene.createModel({id: "src"}).value;
    const srcDataModel = srcData.createModel({id: "src"}).value;
    await new xeokit.formats.xkt.XKTLoader().load({fileData, sceneModel: srcModel, dataModel: srcDataModel});

    // 2. Export the imported model straight back to XKT.
    setStatus("Exporting to XKT…");
    const exported = await new xeokit.formats.xkt.XKTExporter().write({sceneModel: srcModel, dataModel: srcDataModel});

    // 3. Re-import the exported bytes into the rendered scene.
    setStatus("Re-importing exported XKT…");
    const sceneModel = scene.createModel({
      id: "xktRoundTrip",
      coordinateSystem: {
        basis: [1, 0, 0,  0, 1, 0,  0, 0, -1],
        origin: [0, 0, 0],
        units: "meters",
      },
    }).value;
    const dataModel = data.createModel({id: "xktRoundTrip"}).value;
    await new xeokit.formats.xkt.XKTLoader().load({fileData: exported, sceneModel, dataModel});

    // Frame the re-imported model once the spatial index has it.
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

    const kb = (n) => `${Math.round(n / 1024)} KB`;
    setStatus(
      `XKT round-trip — source ${kb(fileData.byteLength)} / ${Object.keys(srcModel.objects).length} objects ` +
      `→ exported ${kb(exported.byteLength)} → re-imported ${Object.keys(sceneModel.objects).length} objects, ` +
      `${Object.keys(sceneModel.meshes).length} meshes, ${Object.keys(dataModel.objects).length} metadata objects.`,
    );
    studio.finished();

  } catch (err) {
    setStatus(`Failed XKT round-trip: ${err.message || err}`);
    console.error(err);
  }
});
