// Sun study for the Duplex at a notional Vancouver site.
//
// `SunStudy` owns:
//   - The site lat/lon (49.28°N, -123.12°W) and the model's
//     north-rotation in the scene.
//   - A `currentDate` cursor.
//   - A `DirLight` self-registered on the view, re-aimed and
//     re-coloured every cursor change.
//
// `AnnualSunPlayer` drives the cursor through either a single
// day (00:00 → 24:00 looping) or a whole year (Jan 1 → Dec 31
// looping) at a configurable pace.
//
// `SunStudyPanel` (opened through Studio's panel registry) exposes
// the site inputs, date picker, time slider, play/pause, mode toggle,
// and live sun altitude / azimuth readout. Wiring is two-way — moving
// the slider drives the SunStudy and the SunStudy's `onChanged` event
// keeps the panel readouts in sync.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;
  const Sun = xeokit.presentations.sunStudy;

  // ── Load the Duplex ──────────────────────────────────────────────
  const sceneModel = mustCreate(scene.createModel({
    id: "duplex",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    },
  }));

  try {
    await studio.loadModel({
      id:     "duplex",
      src:    "../../models/Duplex/xgf/model.xgf",
      format: "xgf",
      sceneModel,
    });
  } catch (err) {
    console.error("Error loading Duplex XGF:", err);
    return;
  }

  // ── View ─────────────────────────────────────────────────────────
  //
  // A southerly-elevated view so the (northern-hemisphere) noon sun
  // is roughly behind the camera — strong cast shadows on the
  // facing facade.
  const view = studio.viewManager.createView({
    camera: {
      eye:  [ 32,  18, 18],
      look: [  4,   8,  3],
      up:   [  0,   0,  1],
      perspectiveProjection: { near: 0.01, far: 1000 },
    },
  });

  // ── Shadows ──────────────────────────────────────────────────────
  //
  // Switch into RealisticRender (which Shadows.renderModes defaults
  // to) and widen the effect's modes to cover DetailedRender too,
  // so the cast-shadow pass is active in either mode. Bump the
  // projection size + light distance so the shadow-map frustum
  // covers the Duplex's full extent without aliasing.
  //
  // SunStudy below will rewrite `shadows.direction` on every cursor
  // change to match the sun position, and scale `shadows.intensity`
  // by sin(altitude) so noon shadows are crisp and dusk shadows
  // fade. The initial values written here are the **peak** density
  // and the static map geometry — only the direction + per-frame
  // intensity float around them.
  const C = xeokit.base.constants;
  view.renderMode = C.RealisticRender;
  view.effects.shadows.renderModes   = [C.RealisticRender, C.DetailedRender];
  view.effects.shadows.intensity     = 0.55;
  view.effects.shadows.resolution    = 2048;
  view.effects.shadows.projectionSize = 35;
  view.effects.shadows.lightDistance = 60;

  // ── Sun study ────────────────────────────────────────────────────
  //
  // Vancouver, summer solstice noon UTC (≈04:00 local PDT — but the
  // sun-position algorithm works off the absolute UTC instant + the
  // site lat/lon, so the rendered shadows match where the sun
  // actually is at this UTC moment at this site, regardless of the
  // observer's wall clock).
  const sunStudy = new Sun.SunStudy({
    view,
    latitude:           49.28,
    longitude:        -123.12,
    northAngleDegrees:   0,
    currentDate:        "2026-06-21T20:00:00Z",   // ~13:00 PDT
  });

  for (const light of [...view.lightsList]) {
    //if (light !== sunStudy.sunLight && typeof light.destroy === "function") {
      light.destroy();
    //}
  }

  const player = new Sun.AnnualSunPlayer({
    sunStudy,
    mode:            "day",
    durationSeconds: 10,
    autoPlay:        false,
  });

  // ── Panel ────────────────────────────────────────────────────────
  studio.panels.open("sunStudyPanel", { sunStudy, player });

  // ── Info panel — describes the demo ─────────────────────────────
  await studio.openInfoPanelFromMeta();

  // ── Daylight-analysis panel ─────────────────────────────────────
  //
  // Opened through Studio's panel registry (same route SchedulePanel
  // and SunStudyPanel use). The panel auto-fits its grid to the
  // scene AABB on first mount, exposes editable bounds + resolution
  // + time-resolution inputs, and owns the lifecycle of the heatmap
  // SceneModel it builds — each "Run" replaces the previous one.
  studio.panels.open("daylightAnalysisPanel", { sunStudy, scene });

  studio.finished();

}).catch((err) => {
  console.error("[presentations_sunStudy_duplex]", err);
});


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
