// CityJSON round-trip: load → export → re-import → view.
//
// Loads the LoD3 Railway CityJSON into a temporary SceneModel + DataModel,
// writes it back out with CityJSONExporter, then re-imports the exported
// document into the SceneModel + DataModel that are actually displayed. If the
// exporter's geometry, per-mesh transforms, materials and the city-object
// hierarchy survive the cycle, the re-imported model renders identically to the
// original — the end-to-end check for CityJSONExporter.
//
// CityJSONExporter emits a plain CityJSON object (vertices quantised against a
// `transform`, each SceneObject a CityObject with a MultiSurface geometry); the
// same document JSON.stringifies straight to a `.city.json` file. Rebuild the
// bundle (`npm run website-build-xeokit-lib`) if CityJSONExporter is missing
// from `xeokit.formats.cityjson`.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const CITYJSON_URL = "../../models/LoD3_Railway/cityjson/model.json";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene, data } = studio;

  // CityJSON is +Z-up — keep the camera's up vector on +Z.
  const view = studio.viewManager.createView({
    id: "demoView",
    camera: { eye: [11.50, 16.32, 15.12], look: [9.01, 9.65, 11.22], up: [0, 0, 1] }
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  const counts = (m) => ({
    objects: Object.keys(m.objects).length,
    meshes: Object.keys(m.meshes).length,
    geometries: Object.keys(m.geometries).length,
  });

  try {
    setStatus("Loading original CityJSON…");
    const fileData = await (await fetch(CITYJSON_URL)).json();

    // 1. Load the original into temporary scene + data models.
    const origSceneRes = scene.createModel({ id: "cityjsonOriginal" });
    if (!origSceneRes.ok) throw new Error(origSceneRes.error);
    const origDataRes = data.createModel({ id: "cityjsonOriginal" });
    if (!origDataRes.ok) throw new Error(origDataRes.error);
    const originalScene = origSceneRes.value;
    const originalData = origDataRes.value;
    await new xeokit.formats.cityjson.CityJSONLoader().load({
      fileData, sceneModel: originalScene, dataModel: originalData
    });
    const origCounts = counts(originalScene);

    // 2. Export it back to a CityJSON document (scene geometry + city semantics).
    setStatus("Re-exporting CityJSON…");
    const exported = await new xeokit.formats.cityjson.CityJSONExporter().write({
      sceneModel: originalScene, dataModel: originalData
    });

    // 3. Drop the originals so only the round-tripped model is shown.
    originalScene.destroy();
    originalData.destroy();

    // 4. Re-import the exported document into the displayed models.
    setStatus("Re-loading exported CityJSON…");
    const rtSceneRes = scene.createModel({ id: "cityjsonRoundTrip" });
    if (!rtSceneRes.ok) throw new Error(rtSceneRes.error);
    const rtDataRes = data.createModel({ id: "cityjsonRoundTrip" });
    if (!rtDataRes.ok) throw new Error(rtDataRes.error);
    const roundTripScene = rtSceneRes.value;
    const roundTripData = rtDataRes.value;
    await new xeokit.formats.cityjson.CityJSONLoader().load({
      fileData: exported, sceneModel: roundTripScene, dataModel: roundTripData
    });
    const rtCounts = counts(roundTripScene);

    console.log(
      `[CityJSON round-trip] exported ${Object.keys(exported.CityObjects).length} city objects, ` +
      `${exported.vertices.length} shared vertices\n` +
      `  original   : ${JSON.stringify(origCounts)}\n` +
      `  round-trip : ${JSON.stringify(rtCounts)}`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) studio.viewManager.fitToAabb(view, aabb);

    if (status) status.style.display = "none";
    studio.openInfoPanelFromMeta();
    studio.finished();

  } catch (err) {
    setStatus(`Round-trip failed: ${err.message || err}`);
    console.error(err);
  }
});
