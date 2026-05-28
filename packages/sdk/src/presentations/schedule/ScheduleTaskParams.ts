/**
 * Parameters for a single task in a {@link Schedule | Schedule}.
 *
 * @module presentations/schedule
 */
export interface ScheduleTaskParams {

  /** Unique task id within the schedule. */
  id: string;

  /** Human-readable label — surfaced in panels / tooltips. */
  name?: string;

  /**
   * Task start. Accepts a `Date` or any string `Date` can parse —
   * typically an ISO 8601 like `"2026-03-15"` or `"2026-03-15T08:00:00Z"`.
   */
  startDate: Date | string;

  /** Task end. Same accepted forms as {@link startDate}. */
  endDate: Date | string;

  /**
   * Optional parent task id for hierarchical schedules (a summary
   * task containing sub-tasks). The parent's own `startDate` /
   * `endDate` typically span its children but the player doesn't
   * enforce that — both parent and children contribute to the
   * per-object state independently if they share `objectIds`.
   */
  parentId?: string;

  /**
   * SceneObject ids that this task installs / builds / commissions.
   * The {@link SchedulePlayer | player} reads through these to drive
   * per-object visibility, colour, and opacity over time.
   *
   * An object that appears in multiple tasks resolves to the
   * latest-finishing task — the one that's still in-progress (or has
   * completed most recently) at the current date wins. Pass `[]` for
   * pure summary / placeholder tasks that organise the schedule but
   * don't change any object's state.
   */
  objectIds: string[];

  /**
   * RGB tint applied to objects while the task is `InProgress`. The
   * `SchedulePlayer` passes this to `view.setObjectsColorized()`, so
   * the colour multiplies the underlying material. Defaults to a
   * warm construction-orange `[1.0, 0.55, 0.15]` so newly-active
   * tasks read clearly against the grey-tinted ghost state.
   */
  tradeColor?: [number, number, number];

  /**
   * Marks a zero-duration milestone (`startDate === endDate`).
   * Purely informational — the player surfaces these through
   * {@link Schedule.milestones} so UIs can render them as chevrons
   * on a timeline scrubber.
   */
  milestone?: boolean;
}
