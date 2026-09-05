import * as presentations from "@xeokit/website-presentations";
import {Scene} from "@xeokit/sdk/model/scene";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {createExampleRenderer, failExample, finishExample, mustElement, mustOk} from "../../../utils/standaloneRuntime.js";
import {createModelNavigationPick, IDENTITY_COORDINATE_SYSTEM, loadXGFModel, positionPanelTopRight} from "../../../utils/workflowRuntime.js";
import {SchedulePanel} from "../../../../libs/studio/src/panels/schedulePanel/SchedulePanel.ts";
// 4D construction scheduling for the Duplex.
//
// Links schedule tasks to model state so the Duplex construction sequence can
// be scrubbed or played as a 4D BIM timeline.

async function main() {
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const Schedule = presentations.schedule.Schedule;
  const SchedulePlayer = presentations.schedule.SchedulePlayer;

  // ── Load the Duplex ──────────────────────────────────────────────
  //
  // XGF v1.1.0 is the path that round-trips materials + textures, so
  // the Complete state of each object renders against its original
  // material rather than a fallback. v1.0.0 would also work for this
  // example since the player tints via colorize on top of whatever
  // the renderer's base material is.
  const sceneModel = mustOk(scene.createModel({
    id: "duplex",
    // XGF stores the render payload, while the website sidecar stores
    // the coordinate-system metadata. Declare it explicitly here so
    // stage bucketing by world Z uses the intended metre frame.
    coordinateSystem: IDENTITY_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  // ── View + initial camera ────────────────────────────────────────
  //
  // Slight 3/4 elevation so the storey-by-storey reveal reads as
  // depth rather than a head-on facade slide.
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    adaptiveQuality: false,
    camera: {
      eye:  [-22, -18, 13],
      look: [  4,   4,  4],
      up:   [  0,   0,  1],
      perspectiveProjection: { near: 0.01, far: 1000 },
    },
  }));
  const renderer = await createExampleRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: createModelNavigationPick(view, picker)
  });

  await loadXGFModel("../../../../models/Duplex/xgf/model.xgf", sceneModel);

  // ── Partition the SceneObjects into 6 construction stages ───────
  //
  // We don't have IFC metadata in the XGF, so the partition is
  // purely geometric: bucket each object by its AABB centre Z, with
  // anything way off to the side (the Duplex's IfcSite plane) routed
  // into the foundations bucket. The result is a believable
  // ground-up assembly without needing a property-set query.
  const ci = getSceneCollisionIndex(scene);
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
  // Floating Gantt view top-left of the viewport. Two-way bound
  // to the player: click on the timeline (or drag the cursor) to
  // scrub, click a task bar to jump to its start, click a milestone
  // diamond to jump to it. Play / step buttons + speed slider live
  // in the panel's chrome bar.
  //
  // Open the panel directly. The workflow owns the SDK scene/view setup;
  // the presentation panel only receives the player it should render.
  SchedulePanel.openFor({
    player,
    title: "4D BIM Construction Schedule",
    storageKey: "xkt-sch-panel-presentations-schedule-duplex",
  });
  positionPanelTopRight(".xkt-sch-panel");

  // ── Fly the camera to each milestone's currently-active scope ──
  //
  // On every milestone crossing, fit the camera to the AABB of all
  // objects from tasks that *finish at or before* the milestone
  // date — i.e. "the part of the building that exists at this
  // milestone". Uses the cinematic flyTo config from the rest of
  // the SDK (arc apex + slow-fast-slow ease).
  const cameraFlight = new CameraFlightAnimation(view, {duration: 0});
  player.onMilestone.subscribe((p, milestone) => {
    const completedIds = [];
    for (const t of schedule.tasksList) {
      if (t.objectIds.length === 0) continue;
      if (t.endMs <= milestone.startMs) completedIds.push(...t.objectIds);
    }
    if (completedIds.length === 0) return;
    const aabb = ci.getCombinedObjectAABB?.(completedIds);
    if (!aabb) return;
    cameraFlight.flyTo({
      aabb,
      fitFOV:   45,
      duration: 1.4,
      arc:      true,
      easing:   "inThenOut",
    });
  });

  finishExample(renderer, view);
}

main().catch((error) => failExample("workflows/schedule/duplex", error));
