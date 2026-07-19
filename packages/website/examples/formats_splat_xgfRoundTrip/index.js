// Splat → XGF → splat round-trip: load .splat → export to native XGF → re-import → view.
//
// Loads a .splat capture into a temporary SceneModel, exports it to xeokit's
// native binary XGF with XGFExporter, then re-imports the XGF bytes into the
// displayed SceneModel.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// antimatter15 .splat sample (Train scene). Source dataset is research /
// non-commercial — swap in your own capture for production use.
const SPLAT_URL = "../../models/Train/splat/model.splat";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [0, 0, 4],
      look: [0, 0, 0],
      up:   [0, 1, 0]
    }
  });

  const status = document.getElementById("status");
  const caption = document.getElementById("caption");
  const setStatus = (text) => { if (status) status.textContent = text; };

  const splatCount = (m) =>
    Object.values(m.geometries).reduce((n, g) => n + g.positionsCompressed.length / 3, 0);

  try {
    setStatus("Loading original .splat…");
    const resp = await fetch(SPLAT_URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${SPLAT_URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    // 1. Load the .splat into a temporary model.
    const origRes = scene.createModel({ id: "splatOriginal" });
    if (!origRes.ok) throw new Error(origRes.error);
    const original = origRes.value;
    await new xeokit.formats.gaussiansplat.GaussianSplatLoader().load({ fileData, sceneModel: original });
    const origCount = splatCount(original);

    // 2. Export to native XGF. The exporter auto-selects v3 because the model
    //    contains splats — passing no `version` is enough.
    setStatus("Exporting to XGF…");
    const xgf = await new xeokit.formats.xgf.XGFExporter().write({ sceneModel: original });
    const xgfVersion = new DataView(xgf).getUint32(0, true);

    // 3. Drop the original so only the round-tripped model is shown.
    original.destroy();

    // 4. Re-import the XGF bytes into the displayed model.
    setStatus("Re-loading from XGF…");
    const rtRes = scene.createModel({ id: "splatXgfRoundTrip" });
    if (!rtRes.ok) throw new Error(rtRes.error);
    const roundTrip = rtRes.value;
    await new xeokit.formats.xgf.XGFLoader().load({ fileData: xgf, sceneModel: roundTrip });
    const rtCount = splatCount(roundTrip);

    console.log(
      `[splat → XGF round-trip] XGF v${xgfVersion}, ${xgf.byteLength} bytes\n` +
      `  original   : ${origCount} splats\n` +
      `  round-trip : ${rtCount} splats`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) studio.viewManager.fitToAabb(view, aabb);

    if (status) status.style.display = "none";
    if (caption) caption.style.display = "";
    studio.finished();

  } catch (err) {
    setStatus(`XGF round-trip failed: ${err.message || err}`);
    console.error(err);
  }
});
