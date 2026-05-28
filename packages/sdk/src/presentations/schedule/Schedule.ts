import type {ScheduleParams} from "./ScheduleParams";
import {ScheduleTask} from "./ScheduleTask";


/**
 * A construction (or commissioning / dismantling / any-other-domain)
 * schedule — a list of {@link ScheduleTask | ScheduleTasks}, each
 * mapping a date range to a set of {@link model!scene.SceneObject | SceneObject}
 * ids it activates.
 *
 * The schedule is immutable once constructed. To mutate, replace the
 * {@link SchedulePlayer | player}'s schedule (or rebuild the player).
 *
 * @module presentations/schedule
 */
export class Schedule {

  /** Tasks indexed by their `id` for O(1) lookup. */
  public readonly tasks: Map<string, ScheduleTask>;

  /** Tasks listed in `startDate` order — the order the {@link SchedulePlayer}
   *  iterates for state classification. */
  public readonly tasksList: ReadonlyArray<ScheduleTask>;

  /** Earliest `startDate` across all tasks — the timeline's lower bound. */
  public readonly startDate: Date;

  /** Latest `endDate` across all tasks — the timeline's upper bound. */
  public readonly endDate: Date;

  /** Convenience: total duration covered by the schedule, in days. */
  public readonly durationDays: number;

  /** Just the milestone tasks (zero-duration or `milestone: true`).
   *  Returned in `startDate` order so UI scrubbers can plot them as
   *  chevrons along the timeline. */
  public readonly milestones: ReadonlyArray<ScheduleTask>;

  constructor(params: ScheduleParams) {
    if (!params || !Array.isArray(params.tasks) || params.tasks.length === 0) {
      throw new Error("[Schedule] params.tasks must be a non-empty array");
    }
    this.tasks = new Map();
    const list: ScheduleTask[] = [];
    for (const tp of params.tasks) {
      if (this.tasks.has(tp.id)) {
        throw new Error(`[Schedule] duplicate task id: '${tp.id}'`);
      }
      const t = new ScheduleTask(tp);
      this.tasks.set(t.id, t);
      list.push(t);
    }
    list.sort((a, b) => a.startMs - b.startMs);
    this.tasksList = list;

    let minMs = Infinity, maxMs = -Infinity;
    for (const t of list) {
      if (t.startMs < minMs) minMs = t.startMs;
      if (t.endMs   > maxMs) maxMs = t.endMs;
    }
    this.startDate = new Date(minMs);
    this.endDate   = new Date(maxMs);
    this.durationDays = (maxMs - minMs) / (24 * 60 * 60 * 1000);

    this.milestones = list.filter(t => t.milestone);
  }

  /**
   * All tasks active at the given moment (status `InProgress`).
   * Linear scan over `tasksList` — fine for the few-hundred-task
   * schedules typical of construction projects.
   */
  public getTasksAt(nowMs: number): ScheduleTask[] {
    const out: ScheduleTask[] = [];
    for (const t of this.tasksList) {
      if (nowMs >= t.startMs && nowMs < t.endMs) out.push(t);
    }
    return out;
  }
}
