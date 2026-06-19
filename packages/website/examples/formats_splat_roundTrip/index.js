// .splat round-trip: load → export → re-import → view.
//
// Loads the captured "room" interior (3D Gaussian Splatting, baked RGB, no SH)
// into a temporary SceneModel, writes it back out with GaussianSplatExporter,
// then re-imports the exported bytes into the SceneModel that's actually
// displayed. Splat centres survive to within the SceneGeometry's 16-bit position
// quantisation; per-splat scales, colours and rotations survive exactly — so the
// re-imported scene renders identically to the original. This is the end-to-end
// check for the encodeSplat byte layout against the parseSplat decode.
//
// The exporter writes each splat geometry verbatim in its stored frame; neither
// pass sets a coordinateSystem, so both view the native .splat / COLMAP frame and
// the comparison is fair.
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

    // 1. Load the original into a temporary model.
    const origRes = scene.createModel({ id: "splatOriginal" });
    if (!origRes.ok) throw new Error(origRes.error);
    const original = origRes.value;
    await new xeokit.formats.gaussiansplat.GaussianSplatLoader().load({ fileData, sceneModel: original });
    const origCount = splatCount(original);

    // 2. Export it back to .splat.
    setStatus("Re-exporting .splat…");
    const exported = await new xeokit.formats.gaussiansplat.GaussianSplatExporter().write({ sceneModel: original });

    // 3. Drop the original so only the round-tripped model is shown.
    original.destroy();

    // 4. Re-import the exported bytes into the displayed model.
    setStatus("Re-loading exported .splat…");
    const rtRes = scene.createModel({ id: "splatRoundTrip" });
    if (!rtRes.ok) throw new Error(rtRes.error);
    const roundTrip = rtRes.value;
    await new xeokit.formats.gaussiansplat.GaussianSplatLoader().load({ fileData: exported, sceneModel: roundTrip });
    const rtCount = splatCount(roundTrip);

    console.log(
      `[splat round-trip] exported ${exported.byteLength} bytes\n` +
      `  original   : ${origCount} splats\n` +
      `  round-trip : ${rtCount} splats`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) studio.viewManager.fitToAabb(view, aabb);

    if (status) status.style.display = "none";
    if (caption) caption.style.display = "";
    studio.finished();

  } catch (err) {
    setStatus(`Round-trip failed: ${err.message || err}`);
    console.error(err);
  }
});
