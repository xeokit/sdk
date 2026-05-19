// IFC Materials + Section Caps — Duplex.
//
// Loads the Duplex SceneModel + DataModel, paints each
// SceneObject with the procedural IFC material that matches its
// IFC type, then runs `xeokit.presentations.sectionCaps.createSectionCaps` to
// build a second SceneModel of filled cap geometry that lies on
// the section plane. The cap meshes inherit each source
// material's `hatchPattern`, so when the View is in
// `DetailedRender` (the default here) the caps draw with the
// same engineering hatch as the source body — wood diagonals on
// wall caps, ANSI 32 crosshatch on steel members, ISO concrete
// fine on slabs, and so on.
//
// The cap SceneModel's objects are marked non-clippable so the
// same section plane that slices the source model leaves the cap
// polygons intact on the cut plane. The renderer's stencil cap
// pass (a separate effect named `sectionPlaneCaps` on the View)
// is disabled in this example since the caps are now real
// geometry — no need for the screen-space fill.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const MODEL_BASE = "../../models/Duplex";
const CAP_PLANE_Z_DEFAULT = 2.6;

async function main() {

  const studio = new xeokit.studio.Studio({});
  await studio.init();

  const {scene, data} = studio;

  // ── Source DataModel + SceneModel populated from the Duplex
  //    XGF / datamodel assets.
  const dataModelResult = data.createModel({id: "duplex"});
  if (!dataModelResult.ok) throw new Error(dataModelResult.error);
  const dataModel = dataModelResult.value;

  const sourceSceneModelResult = scene.createModel({
    id: "duplex",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0,
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    },
  });
  if (!sourceSceneModelResult.ok) throw new Error(sourceSceneModelResult.error);
  const sourceSceneModel = sourceSceneModelResult.value;

  await studio.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/datamodel/model.json`,
    format: "datamodel",
    dataModel,
  });

  await studio.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/xgf/model.xgf`,
    format: "xgf",
    sceneModel: sourceSceneModel,
  });

  // ── Attach procedural IFC materials to the source model. Each
  // SceneObject's IFC type is read from the DataModel and its
  // SceneMeshes get a SceneMaterial whose `hatchPattern` matches
  // engineering convention (ANSI 31 wood for walls, ISO concrete
  // for slabs, ANSI 32 steel crosshatch for railings/plates, etc.).
  // `createSectionCaps` copies the same hatchPattern onto each emitted
  // cap material, so the caps draw hatched in DetailedRender.
  const attachResult = await xeokit.studio.applyIFCMaterials.applyIFCMaterials({
    sceneModel: sourceSceneModel,
    dataModel,
    textureSize: 256,
  });
  if (!attachResult.ok) throw new Error(attachResult.error);

  // ── Cap SceneModel — destination for the cap geometry. Empty
  // until `createSectionCaps` populates it. No coordinateSystem here
  // because the cap geometry is emitted in world space (the
  // extractor pre-multiplies each source mesh's worldMatrix).
  const capSceneModelResult = scene.createModel({id: "duplex-caps"});
  if (!capSceneModelResult.ok) throw new Error(capSceneModelResult.error);
  const capSceneModel = capSceneModelResult.value;

  // ── Extract section caps for the default cut plane. World is
  // Z-up after the Duplex coordinate-system swap, so the cut
  // normal is +Z. Re-running the extractor when the slider moves
  // is shown below.
  const extractResult = xeokit.presentations.sectionCaps.createSectionCaps({
    sourceSceneModel,
    targetSceneModel: capSceneModel,
    capPlanes: [
      {dir: [0, 0, 1], dist: -CAP_PLANE_Z_DEFAULT},
    ],
    capColor: [0.55, 0.56, 0.58],
    idPrefix: "cap",
  });
  if (!extractResult.ok) throw new Error(extractResult.error);

  // ── View. Defaults to DetailedRender so `bodyHatch.applied` is
  // true on both the source meshes AND the cap meshes — caps draw
  // with the same per-material hatch as the source body.
  const view = studio.viewManager.createView({
    camera: {
      eye:  [31.387, 32.115, 14.796],
      look: [0.612, 6.667, 2.524],
      up:   [-0.226, -0.187, 0.956],
    },
    renderMode: xeokit.base.constants.DetailedRender,
    effects: {
      tonemap: {sRGBEncode: true},
      // Renderer-side stencil cap pass disabled: the caps are
      // real geometry now, so the fullscreen cap quad is
      // redundant. Set to a non-empty list to layer both. Note
      // this `sectionPlaneCaps` is the renderer-effect name and
      // is distinct from the `xeokit.presentations.sectionCaps` module
      // used above.
      sectionPlaneCaps: {renderModes: []},
    },
  });

  // Mark every cap object non-clippable so the section plane
  // that slices the source model leaves the caps intact on the
  // cut plane. Source objects (everything else in the view)
  // remain clippable.
  const capObjectIds = Object.keys(capSceneModel.objects);
  view.setObjectsClippable(capObjectIds, false);

  // ── Section plane. The same plane fed into `createSectionCaps`
  // above — that's what makes the caps land on the cut plane.
  const planeResult = view.createSectionPlane({
    id: "horizontal",
    pos: [0, 0, CAP_PLANE_Z_DEFAULT],
    dir: [0, 0, 1],
    active: true,
  });
  if (!planeResult.ok) throw new Error(planeResult.error);
  const sectionPlane = planeResult.value;

  // ── UI bindings ──────────────────────────────────────────────
  const planeBtn    = document.getElementById("planeToggle");
  const planeOffset = document.getElementById("planeOffset");
  const capsBtn     = document.getElementById("capsToggle");
  const modeBtn     = document.getElementById("modeToggle");
  const statsEl     = document.getElementById("stats");

  statsEl.textContent =
    `${extractResult.value.numObjectsWithCaps} objects, ` +
    `${extractResult.value.numCapMeshes} cap meshes` +
    (extractResult.value.numUnclosedMeshes
      ? `, ${extractResult.value.numUnclosedMeshes} unclosed` : "");

  // Section plane: slider sets the world Z of the plane; toggle
  // flips it on/off. Slider movement re-extracts the cap geometry
  // so the caps follow the cut. Re-extracting destroys the prior
  // cap SceneModel and builds a fresh one — Duplex is small enough
  // (~600 objects) that this stays interactive.
  let currentCapModel = capSceneModel;
  let capRebuildSeq = 0;

  function syncPlaneBtn() {
    planeBtn.textContent = sectionPlane.active ? "on" : "off";
    planeBtn.setAttribute("aria-pressed", String(sectionPlane.active));
  }
  planeBtn.addEventListener("click", () => {
    sectionPlane.active = !sectionPlane.active;
    syncPlaneBtn();
  });
  planeOffset.addEventListener("input", () => {
    const z = parseFloat(planeOffset.value);
    sectionPlane.pos = [0, 0, z];
    rebuildCaps(z);
  });
  syncPlaneBtn();

  function rebuildCaps(z) {
    const seq = ++capRebuildSeq;
    // Destroy the previous cap model and emit a new one at the
    // current slider position.
    currentCapModel.destroy();
    const r = scene.createModel({id: `duplex-caps-${seq}`});
    if (!r.ok) { console.error(r.error); return; }
    const m = r.value;
    const e = xeokit.presentations.sectionCaps.createSectionCaps({
      sourceSceneModel,
      targetSceneModel: m,
      capPlanes: [{dir: [0, 0, 1], dist: -z}],
      capColor: [0.55, 0.56, 0.58],
      idPrefix: `cap${seq}`,
    });
    if (!e.ok) { console.error(e.error); m.destroy(); return; }
    view.setObjectsClippable(Object.keys(m.objects), false);
    currentCapModel = m;
    statsEl.textContent =
      `${e.value.numObjectsWithCaps} objects, ${e.value.numCapMeshes} cap meshes` +
      (e.value.numUnclosedMeshes ? `, ${e.value.numUnclosedMeshes} unclosed` : "");
  }

  // Caps: hide the cap SceneObjects' ViewObjects when off. The
  // cap geometry stays in memory; only its render visibility
  // toggles.
  let capsOn = true;
  function syncCapsBtn() {
    capsBtn.textContent = capsOn ? "on" : "off";
    capsBtn.setAttribute("aria-pressed", String(capsOn));
  }
  capsBtn.addEventListener("click", () => {
    capsOn = !capsOn;
    view.setObjectsVisible(Object.keys(currentCapModel.objects), capsOn);
    syncCapsBtn();
  });

  // Mode: flip between Detailed (hatched-Lambert body and caps)
  // and Realistic (PBR body, caps still solid-filled with their
  // material colour but no hatch overlay since `bodyHatch`
  // doesn't apply in Realistic).
  function syncModeBtn() {
    const detailed = view.renderMode === xeokit.base.constants.DetailedRender;
    modeBtn.textContent = detailed ? "Detailed" : "Realistic";
    modeBtn.setAttribute("aria-pressed", String(detailed));
  }
  modeBtn.addEventListener("click", () => {
    view.renderMode = (view.renderMode === xeokit.base.constants.DetailedRender)
      ? xeokit.base.constants.RealisticRender
      : xeokit.base.constants.DetailedRender;
    syncModeBtn();
  });
  syncModeBtn();

  studio.finished();
}

main().catch(err => {
  console.error("[IFCMaterials_SectionCaps_Duplex]", err);
});
