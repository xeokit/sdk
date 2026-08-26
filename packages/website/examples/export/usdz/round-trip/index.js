// USDZ round-trip: load → export → re-import → view.
//
// Loads the ResidentialBuilding USDZ into a temporary SceneModel, writes it back
// out with USDZExporter, then re-imports the exported bytes into the SceneModel
// that's actually displayed. If the exporter's geometry, per-mesh transforms and
// materials survive the cycle, the re-imported model renders identically to the
// original — this is the end-to-end check for the matrix convention in buildUSDA.
//
// Browser only: the loader (both passes) uses the web-only tinyusdz wasm. The
// exporter is pure JS. Rebuild the bundle (`npm run website-build-xeokit-lib`) if
// USDZExporter is missing from `xeokit.formats.usdz`.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const USDZ_URL = "../../../../models/ResidentialBuilding/usdz/model.usdz";

// USD is Y-up; keep both passes on the same basis so the comparison is fair.
const COORD = {
  basis:  [1, 0, 0,  0, 1, 0,  0, 0, 1],
  origin: [0, 0, 0],
  units:  "meters",
  scaleToMeters: 1
};

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: { eye: [20, 15, 20], look: [0, 0, 0], up: [0, 0, 1] }
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  const counts = (m) => ({
    objects: Object.keys(m.objects).length,
    meshes: Object.keys(m.meshes).length,
    geometries: Object.keys(m.geometries).length,
  });

  try {
    setStatus("Loading original USDZ…");
    const fileData = await (await fetch(USDZ_URL)).arrayBuffer();

    // 1. Load the original into a temporary model.
    const origRes = scene.createModel({ id: "usdzOriginal", coordinateSystem: COORD });
    if (!origRes.ok) throw new Error(origRes.error);
    const original = origRes.value;
    await new xeokit.formats.usdz.USDZLoader().load({ fileData, sceneModel: original });
    const origCounts = counts(original);

    // 2. Export it back to USDZ.
    setStatus("Re-exporting USDZ…");
    const exported = await new xeokit.formats.usdz.USDZExporter().write({ sceneModel: original });

    // 3. Drop the original so only the round-tripped model is shown.
    original.destroy();

    // 4. Re-import the exported bytes into the displayed model.
    setStatus("Re-loading exported USDZ…");
    const rtRes = scene.createModel({ id: "usdzRoundTrip", coordinateSystem: COORD });
    if (!rtRes.ok) throw new Error(rtRes.error);
    const roundTrip = rtRes.value;
    await new xeokit.formats.usdz.USDZLoader().load({ fileData: exported, sceneModel: roundTrip });
    const rtCounts = counts(roundTrip);

    console.log(
      `[USDZ round-trip] exported ${exported.byteLength} bytes\n` +
      `  original   : ${JSON.stringify(origCounts)}\n` +
      `  round-trip : ${JSON.stringify(rtCounts)}`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) studio.viewManager.fitToAabb(view, aabb);

    if (status) status.style.display = "none";
    studio.finished();

  } catch (err) {
    setStatus(`Round-trip failed: ${err.message || err}`);
    console.error(err);
  }
});
