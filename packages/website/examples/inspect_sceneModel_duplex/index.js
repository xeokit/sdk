// Demo of the SDK's `sceneModelInspector` toolkit. URL-driven loader
// (mirrors `ModelLoader_viewModel`): pass `?modelId=<id>&format=<fmt>`
// to load any model + format combo from the demo collection.
//
// All Inspector UI lives inside `xeokit.studio.modelInspectionPanel.ModelInspectionPanel`
// — the panel mounts its own DOM, declares its own scoped CSS,
// runs inspections, dispatches fixes, and persists its drag state.
// This file just (a) loads the model, (b) constructs the panel,
// (c) calls `panel.inspect()` once the model is ready.
import * as xeokit from "../../js/xeokit-studio-bundle.js";


/**
 * Load the per-model coordSys.json that lives next to the model
 * data in `models/<modelId>/coordSys.json`. Lifted from
 * `ModelLoader_viewModel`.
 */
async function loadCoordinateSystemFromFile(modelId) {
  const coordSysPath = `../../models/${encodeURIComponent(modelId)}/coordSys.json`;
  const response = await fetch(coordSysPath, {cache: "no-cache"});
  if (!response.ok) throw new Error(`Failed to load coordSys.json at ${coordSysPath}`);
  const json = await response.json();
  if (!json || !Array.isArray(json.basis) || !Array.isArray(json.origin) || typeof json.units !== "string") {
    throw new Error(`Invalid coordSys.json at ${coordSysPath}`);
  }
  return json;
}

function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

const studio = new xeokit.studio.Studio({});

studio.init({logging: false}).then(async () => {

  const {scene, data} = studio;

  const view = studio.viewManager.createView({});

  // Asymmetric frustum projection — shifts the view slightly
  // rightward so the model sits a touch off-centre to the *left*
  // of the canvas (the inspection panel covers the right column).
  // Right plane > |left plane|, top/bottom symmetric.
  const cam = view.camera;
  cam.frustumProjection.near   = 0.1;
  cam.frustumProjection.far    = 10000;
  cam.frustumProjection.top    =  0.05;
  cam.frustumProjection.bottom = -0.05;
  cam.frustumProjection.left   = -0.06;
  cam.frustumProjection.right  =  0.08;
  cam.projectionType = xeokit.base.constants.FrustumProjectionType;

  const status = document.getElementById("status");

  // ── URL parameters ──────────────────────────────────────────
  // ?modelId=<id>&format=<fmt[,fmt2,...]>
  // Defaults preserve the original FM_LFT/IFC behaviour when the
  // example is opened with no query string.
  const params      = new URLSearchParams(window.location.search);
  const modelId     = params.get("modelId") || "FM_LFT";
  const formatParam = params.get("format")  || "ifc";
  const formats = formatParam.split(",").map(s => s.trim()).filter(Boolean);

  status.textContent = `Loading ${modelId} (${formats.join(", ")})…`;

  try {
    const coordinateSystem = await loadCoordinateSystemFromFile(modelId);
    const sceneModel = mustCreate(scene.createModel({id: "demoModel", coordinateSystem}));
    const dataModel  = mustCreate(data.createModel({id: "demoModel"}));

    for (const format of formats) {
      await studio.loadModel({modelId, format, sceneModel, dataModel}, {});
    }

    // Mount the panel. It listens for `xeokit:inspect-model`
    // events from the right-click menu so the "Inspect Model"
    // entry on ViewObjectContextMenu reopens / re-runs against
    // this SceneModel automatically.
    const panel = new xeokit.studio.modelInspectionPanel.ModelInspectionPanel({
      sceneModel,
      view,
      studio,
    });

    status.style.display = "none";

    // First inspect baselines the panel's stats grid so post-fix
    // delta chips have an anchor.
    const report = await panel.inspect("Inspecting model");
    if (!report) return;     // user cancelled the initial inspect

    studio.viewFit(view);

    studio.finished();
  } catch (err) {
    status.textContent = `Failed to load ${modelId} (${formats.join(", ")}): ${err.message || err}`;
    console.error(err);
  }
});
