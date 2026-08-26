import * as presentations from "../../../../libs/presentations/dist/index.js";
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

import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;
  const Sun = presentations.sunStudy;

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
      src:    "../../../../models/Duplex/xgf/model.xgf",
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

  // Use the SunStudy-owned DirLight as the only illumination source.
  // View construction installs legacy ambient + directional defaults, and
  // undefined enables IBL/hemisphere fill by default; remove those
  // before creating the sun so shaded faces can fall properly dark.
  view.clearLights();
  view.lights.ibl.intensity = 0;
  view.lights.hemispheric.intensity = 0;

  // ── Shadows ──────────────────────────────────────────────────────
  //
  // Use a fixed one-cascade shadow map. The sun-study view is small and
  // static, so this avoids a camera-fit shadow update during the first
  // layout frame.
  //
  // SunStudy below will rewrite `shadows.direction` on every cursor
  // change to match the sun position, and scale `shadows.intensity`
  // by sin(altitude) so noon shadows are crisp and dusk shadows
  // fade. The initial values written here are the **peak** density
  // and the static map geometry — only the direction + per-frame
  // intensity float around them.
  view.effects.shadows.enabled = false;
  view.effects.shadows.intensity     = 0.55;
  view.effects.shadows.resolution    = 2048;
  view.effects.shadows.autoFit       = false;
  view.effects.shadows.cascadeCount  = 1;
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

  const player = new Sun.AnnualSunPlayer({
    sunStudy,
    mode:            "day",
    durationSeconds: 10,
    autoPlay:        false,
  });

  // ── Panel ────────────────────────────────────────────────────────
  studio.panels.open("sunStudyPanel", { sunStudy, player });
  positionPanelTopRight(".xkt-sun-panel");

  await warmStartupShadows(view);
  studio.finished();

}).catch((err) => {
  console.error("[workflows/sun-study/duplex]", err);
});


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function positionPanelTopRight(selector) {
  const panel = document.querySelector(selector);
  if (!panel) return;
  Object.assign(panel.style, {
    top: "17px",
    right: "17px",
    bottom: "auto",
    left: "auto",
    transform: "none",
  });
}

async function warmStartupShadows(view) {
  await nextFrame();
  view.effects.shadows.enabled = true;
  view.needsRender();
  await nextFrame();
  await nextFrame();
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
