// 4D construction scheduling for the Duplex.
//
// Loads the Duplex as an XGF (cheaper to commit than re-parsing the
// IFC) and then bins every SceneObject into one of six construction
// stages by sweeping the model bottom-to-top by AABB centre Z. The
// resulting synthetic 24-week schedule drives `SchedulePlayer`, which
// transitions each bin through Pending → InProgress → Complete by
// writing per-object visibility / colour / opacity to the data
// textures. Scrubbing the timeline scrolls the cursor; pressing Play
// advances at a configurable schedule-days-per-second cadence.
//
// The point of the example, beyond looking neat, is to demonstrate
// that per-object state changes at BIM-scale aren't an authoring
// pipeline — they're a runtime operation the SDK was built for.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene, presentations } = studio;
  const Schedule = xeokit.presentations.schedule.Schedule;
  const SchedulePlayer = xeokit.presentations.schedule.SchedulePlayer;

  // ── Load the Duplex ──────────────────────────────────────────────
  //
  // XGF v1.1.0 is the path that round-trips materials + textures, so
  // the Complete state of each object renders against its original
  // material rather than a fallback. v1.0.0 would also work for this
  // example since the player tints via colorize on top of whatever
  // the renderer's base material is.
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

  // ── View + initial camera ────────────────────────────────────────
  //
  // Slight 3/4 elevation so the storey-by-storey reveal reads as
  // depth rather than a head-on facade slide.
  const view = studio.viewManager.createView({
    camera: {
      eye:  [-22, -18, 13],
      look: [  4,   4,  4],
      up:   [  0,   0,  1],
      perspectiveProjection: { near: 0.01, far: 1000 },
    },
  });

  // ── Partition the SceneObjects into 6 construction stages ───────
  //
  // We don't have IFC metadata in the XGF, so the partition is
  // purely geometric: bucket each object by its AABB centre Z, with
  // anything way off to the side (the Duplex's IfcSite plane) routed
  // into the foundations bucket. The result is a believable
  // ground-up assembly without needing a property-set query.
  const ci = studio.picking.collisionIndex;
  const sceneAABB = ci.getSceneAABB();
  const minZ = sceneAABB[2];
  const maxZ = sceneAABB[5];
  const span = maxZ - minZ;

  // Stage Z-fraction cutoffs, relative to the scene's vertical extent.
  // Tuned so the Duplex's two storeys + roof + interior fitout each
  // get a recognisable share — the actual numbers fall out of the
  // Duplex's particular geometry, but the pattern is generic.
  const stages = [
    { id: "foundations", label: "Foundations & ground slab",  zMax: 0.05, color: [0.55, 0.40, 0.25] },
    { id: "groundWalls", label: "Ground-floor walls",         zMax: 0.30, color: [0.85, 0.55, 0.20] },
    { id: "midSlab",     label: "First-floor slab",           zMax: 0.45, color: [0.65, 0.45, 0.18] },
    { id: "firstWalls",  label: "First-floor walls",          zMax: 0.70, color: [0.85, 0.55, 0.20] },
    { id: "roof",        label: "Roof + envelope",            zMax: 0.92, color: [0.30, 0.55, 0.80] },
    { id: "fitout",      label: "Interior fit-out & MEP",     zMax: Infinity, color: [0.55, 0.75, 0.40] },
  ];

  const stageObjectIds = stages.map(() => []);

  for (const oid of Object.keys(sceneModel.objects)) {
    const aabb = ci.getObjectAABB(oid);
    if (!aabb) continue;
    const cz = (aabb[2] + aabb[5]) * 0.5;
    const f  = (cz - minZ) / Math.max(1e-6, span);
    for (let i = 0; i < stages.length; i++) {
      if (f <= stages[i].zMax) { stageObjectIds[i].push(oid); break; }
    }
  }

  // ── Build the schedule ──────────────────────────────────────────
  //
  // 24-week project, week 1 starting Mon 2 Mar 2026. Each stage
  // overlaps the next by a week so the trades visibly co-exist on
  // the model — concrete crew finishing the slab while the framing
  // crew starts on the walls above is the canonical "this is what
  // 4D shows you" image. The interior fit-out runs across all 12
  // post-shell weeks so it reads as a slower, sustained activity
  // rather than a sharp transition.
  const week = (n) => new Date(2026, 2, 2 + (n - 1) * 7);   // 2026-03-02 + (n-1) weeks
  const schedule = new Schedule({
    tasks: [
      { id: "foundations", name: stages[0].label, startDate: week(1),  endDate: week(4),
        objectIds: stageObjectIds[0], tradeColor: stages[0].color },
      { id: "groundWalls", name: stages[1].label, startDate: week(3),  endDate: week(8),
        objectIds: stageObjectIds[1], tradeColor: stages[1].color },
      { id: "midSlab",     name: stages[2].label, startDate: week(7),  endDate: week(10),
        objectIds: stageObjectIds[2], tradeColor: stages[2].color },
      { id: "firstWalls",  name: stages[3].label, startDate: week(9),  endDate: week(14),
        objectIds: stageObjectIds[3], tradeColor: stages[3].color },
      { id: "roof",        name: stages[4].label, startDate: week(13), endDate: week(18),
        objectIds: stageObjectIds[4], tradeColor: stages[4].color },
      { id: "fitout",      name: stages[5].label, startDate: week(15), endDate: week(24),
        objectIds: stageObjectIds[5], tradeColor: stages[5].color },
      // Pure milestones — zero-duration, surface in `Schedule.milestones`
      // for the player's onMilestone event to fly the camera to the
      // most recently completed stage.
      { id: "ms_shell",    name: "Shell complete",            startDate: week(14), endDate: week(14),
        objectIds: [], milestone: true },
      { id: "ms_topout",   name: "Top-out",                   startDate: week(18), endDate: week(18),
        objectIds: [], milestone: true },
      { id: "ms_handover", name: "Substantial completion",    startDate: week(24), endDate: week(24),
        objectIds: [], milestone: true },
    ]
  });

  // ── Player ──────────────────────────────────────────────────────
  //
  // 14 schedule-days per real-time second → the full 24-week plays
  // back in ~12 s. Ghosting on for pending tasks gives a wireframe-y
  // preview of the full massing while it builds itself in trade
  // colour underneath.
  const player = new SchedulePlayer({
    schedule,
    view,
    playbackSpeed:     14,
    ghostUpcoming:     true,
    ghostColor:        [0.55, 0.65, 0.80],
    ghostOpacity:      0.14,
    inProgressOpacity: 0.85,
  });

  // ── Gantt panel ────────────────────────────────────────────────
  //
  // Floating Gantt view bottom-left of the viewport. Two-way bound
  // to the player: click on the timeline (or drag the cursor) to
  // scrub, click a task bar to jump to its start, click a milestone
  // diamond to jump to it. Play / step buttons + speed slider live
  // in the panel's chrome bar.
  //
  // Opened through Studio's panel registry (`studio.panels.open`)
  // rather than the panel's static `openFor` — keeps the example
  // aligned with the way the other built-in panels (explorer,
  // boundaries, models, etc.) are launched, and exercises the
  // type-checked `{player}` params shape declared in builtinPanels.
  studio.panels.open("schedulePanel", { player });

  // ── Fly the camera to each milestone's currently-active scope ──
  //
  // On every milestone crossing, fit the camera to the AABB of all
  // objects from tasks that *finish at or before* the milestone
  // date — i.e. "the part of the building that exists at this
  // milestone". Uses the cinematic flyTo config from the rest of
  // the SDK (arc apex + slow-fast-slow ease).
  const record = studio.viewManager.views[view.id];
  player.onMilestone.subscribe((p, milestone) => {
    const completedIds = [];
    for (const t of schedule.tasksList) {
      if (t.objectIds.length === 0) continue;
      if (t.endMs <= milestone.startMs) completedIds.push(...t.objectIds);
    }
    if (completedIds.length === 0) return;
    const aabb = ci.getCombinedObjectAABB?.(completedIds);
    if (!aabb) return;
    record.cameraFlight.flyTo({
      aabb,
      fitFOV:   45,
      duration: 1.4,
      arc:      true,
      easing:   "inThenOut",
    });
  });

  // ── Info-panel UI ───────────────────────────────────────────────
  //
  // A slider for scrubbing, a play/pause toggle, a speed slider, and
  // a current-date readout. Two-way binding: the slider drives the
  // player, the player's onDateChanged drives the readout.
  const info = await studio.openInfoPanelFromMeta();
  info.addSlider({
    label:   "Schedule date",
    min:     0,
    max:     100,
    value:   0,
    onChange: (v) => { player.progress = v / 100; },
  });
  info.addToggle({
    label:   "Playing",
    value:   false,
    onChange: (on) => { on ? player.play() : player.pause(); },
  });
  info.addSlider({
    label:   "Speed (days/sec)",
    min:     1,
    max:     60,
    value:   player.playbackSpeed,
    onChange: (v) => { player.playbackSpeed = v; },
  });
  info.addStat({ id: "currentDate", label: "Date" });
  info.addStat({ id: "weekNumber",  label: "Week" });

  const refreshReadout = () => {
    const d = player.currentDate;
    info.setStat("currentDate", d.toLocaleDateString("en-GB",
      { day: "numeric", month: "short", year: "numeric" }));
    const wk = 1 + Math.floor(
      (d.getTime() - schedule.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    info.setStat("weekNumber", `${wk} of 24`);
  };
  refreshReadout();
  player.onDateChanged.subscribe(refreshReadout);

  studio.finished();

}).catch((err) => {
  console.error("[presentations_schedule_duplex]", err);
});


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
