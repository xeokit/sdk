import * as presentations from "@xeokit/website-presentations";
import {Scene} from "@xeokit/sdk/model/scene";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {AmbientLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {createExampleRenderer, failExample, finishExample, mustElement, mustOk} from "../../../utils/standaloneRuntime.js";
import {createModelNavigationPick, IDENTITY_COORDINATE_SYSTEM, loadXGFModel, positionPanelTopRight} from "../../../utils/workflowRuntime.js";
import {SunStudyPanel} from "../../../../libs/studio/src/panels/sunStudyPanel/SunStudyPanel.ts";
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
// `SunStudyPanel` exposes the site inputs, date picker, time slider,
// play/pause, mode toggle, and live sun altitude / azimuth readout.
// Wiring is two-way — moving the slider drives the SunStudy and the
// SunStudy's `onChanged` event keeps the panel readouts in sync.

async function main() {
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const Sun = presentations.sunStudy;

  // ── Load the Duplex ──────────────────────────────────────────────
  const sceneModel = mustOk(scene.createModel({
    id: "duplex",
    // Duplex's XGF payload is paired with a website coordinate-system
    // sidecar. Declare that metre identity basis here so sun/shadow
    // directions and the model's world frame agree.
    coordinateSystem: IDENTITY_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  // ── View ─────────────────────────────────────────────────────────
  //
  // A southerly-elevated view so the (northern-hemisphere) noon sun
  // is roughly behind the camera — strong cast shadows on the
  // facing facade.
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.78, 0.86, 0.94],
    camera: {
      eye:  [ 32,  18, 18],
      look: [  4,   8,  3],
      up:   [  0,   0,  1],
      perspectiveProjection: { near: 0.01, far: 1000 },
    },
    effects: {
      sky: {
        enabled: true,
        skyColor: [0.58, 0.74, 0.92],
        horizonColor: [0.78, 0.86, 0.92],
        groundColor: [0.50, 0.54, 0.50]
      }
    },
    lights: {
      ibl: {enabled: false, intensity: 0},
      hemispheric: {enabled: false, intensity: 0}
    }
  }));
  const renderer = await createExampleRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: createModelNavigationPick(view, picker)
  });

  await loadXGFModel("../../../../models/Duplex/xgf/model.xgf", sceneModel);

  // Use the SunStudy-owned DirLight as the only illumination source.
  // View construction installs legacy ambient + directional defaults, and
  // undefined enables IBL/hemisphere fill by default; remove those
  // before creating the sun so shaded faces can fall properly dark.
  view.clearLights();
  // Keep an explicit zero ambient light registered. Without one, both
  // renderers fall back to their built-in default ambient term.
  new AmbientLight(view, {color: [0, 0, 0], intensity: 0});
  view.lights.ibl.enabled = false;
  view.lights.ibl.intensity = 0;
  view.lights.hemispheric.enabled = false;
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
  suppressNightSunResidual(sunStudy);

  const player = new Sun.AnnualSunPlayer({
    sunStudy,
    mode:            "day",
    durationSeconds: 10,
    autoPlay:        false,
  });

  // ── Panel ────────────────────────────────────────────────────────
  SunStudyPanel.openFor({ sunStudy, player });
  positionPanelTopRight(".xkt-sun-panel");

  await warmStartupShadows(view);
  finishExample(renderer, view);
}

main().catch((error) => failExample("workflows/sun-study/duplex", error));

async function warmStartupShadows(view) {
  await nextFrame();
  view.effects.shadows.enabled = true;
  await nextFrame();
  await nextFrame();
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function suppressNightSunResidual(sunStudy: any) {
  const apply = () => {
    if (!sunStudy.sunPosition.aboveHorizon) {
      sunStudy.sunLight.intensity = 0;
    }
  };
  sunStudy.onChanged.subscribe(apply);
  apply();
}
