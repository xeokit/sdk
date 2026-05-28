/**
 * Status of a {@link ScheduleTask | ScheduleTask} at a given moment in
 * the timeline. Derived from the relationship between the player's
 * current date and the task's `startDate` / `endDate` — not stored on
 * the task itself.
 *
 * @module presentations/schedule
 */
export enum TaskStatus {

  /** Task has not started yet (`now < task.startDate`). */
  Pending = "pending",

  /** Task is currently underway (`task.startDate ≤ now < task.endDate`). */
  InProgress = "inProgress",

  /** Task has finished (`now ≥ task.endDate`). */
  Complete = "complete",
}
