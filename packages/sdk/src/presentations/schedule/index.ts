/**
 * # 4D Construction Scheduling
 *
 * Maps schedule tasks to SceneObject ids and applies task state to a
 * {@link viewing!viewer.View | View} as the time cursor changes. Objects
 * transition through Pending, InProgress, and Complete as their tasks
 * start and finish.
 *
 * ## Usage
 *
 * ```ts
 * import * as xeokit from "@xeokit/sdk";
 *
 * const schedule = new xeokit.presentations.schedule.Schedule({
 *   tasks: [
 *     {
 *       id:         "foundations",
 *       startDate:  "2026-03-01",
 *       endDate:    "2026-04-15",
 *       objectIds:  foundationIds,
 *       tradeColor: [0.55, 0.35, 0.20],
 *     },
 *     {
 *       id:         "shell",
 *       startDate:  "2026-04-10",
 *       endDate:    "2026-07-01",
 *       objectIds:  shellIds,
 *       tradeColor: [0.85, 0.50, 0.15],
 *     },
 *     {
 *       id:         "envelope",
 *       startDate:  "2026-06-15",
 *       endDate:    "2026-09-01",
 *       objectIds:  envelopeIds,
 *       tradeColor: [0.30, 0.55, 0.85],
 *     },
 *     // ...
 *   ],
 * });
 *
 * const player = new xeokit.presentations.schedule.SchedulePlayer({
 *   schedule,
 *   view,
 *   playbackSpeed: 30,    // 30 schedule-days per real-time second
 *   autoPlay: true,
 * });
 *
 * // Bind to a UI timeline:
 * slider.oninput = () => { player.progress = +slider.value / 100; };
 * playBtn.onclick = () => { player.playing ? player.pause() : player.play(); };
 *
 * // React to milestones:
 * player.onMilestone.subscribe((p, task) => {
 *   record.cameraFlight.flyTo({
 *     aabb:    collisionIndex.getCombinedObjectAABB(task.objectIds),
 *     fitFOV:  45,
 *     duration: 1.8,
 *     arc:      true,
 *     easing:   "inThenOut",
 *   });
 * });
 * ```
 *
 * @module schedule
 */
export * from "./TaskStatus";
export * from "./ScheduleTaskParams";
export * from "./ScheduleTask";
export * from "./ScheduleParams";
export * from "./Schedule";
export * from "./SchedulePlayerParams";
export * from "./SchedulePlayer";
