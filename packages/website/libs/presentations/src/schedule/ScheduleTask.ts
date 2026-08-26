import type {ScheduleTaskParams} from "./ScheduleTaskParams";
import {TaskStatus} from "./TaskStatus";


const DEFAULT_TRADE_COLOR: [number, number, number] = [1.0, 0.55, 0.15];


function asDate(d: Date | string): Date {
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`[ScheduleTask] Unparseable date: ${JSON.stringify(d)}`);
  }
  return parsed;
}


/**
 * Runtime form of a {@link ScheduleTaskParams | ScheduleTaskParams}.
 * Holds the resolved `Date`s, defaulted `tradeColor`, and a `statusAt`
 * helper that the {@link SchedulePlayer | player} calls per tick when
 * it bucketises objects by status.
 *
 * Constructed indirectly through {@link Schedule | Schedule}'s
 * constructor — callers don't instantiate this class themselves.
 *
 * @module presentations/schedule
 */
export class ScheduleTask {

  public readonly id: string;
  public readonly name: string | undefined;
  public readonly startDate: Date;
  public readonly endDate: Date;
  public readonly startMs: number;
  public readonly endMs: number;
  public readonly parentId: string | undefined;
  public readonly objectIds: ReadonlyArray<string>;
  public readonly tradeColor: [number, number, number];
  public readonly milestone: boolean;

  constructor(params: ScheduleTaskParams) {
    this.id = params.id;
    this.name = params.name;
    this.startDate = asDate(params.startDate);
    this.endDate = asDate(params.endDate);
    if (this.endDate.getTime() < this.startDate.getTime()) {
      throw new Error(`[ScheduleTask] '${this.id}' endDate precedes startDate`);
    }
    this.startMs = this.startDate.getTime();
    this.endMs = this.endDate.getTime();
    this.parentId = params.parentId;
    this.objectIds = params.objectIds ?? [];
    this.tradeColor = params.tradeColor ?? DEFAULT_TRADE_COLOR;
    this.milestone = params.milestone === true ||
                     this.startMs === this.endMs;
  }

  /**
   * Status of this task at the given moment (in epoch milliseconds).
   * Compares against `[startMs, endMs)` — i.e. a task that ends at
   * exactly `now` is reported as `Complete`, not `InProgress`.
   */
  public statusAt(nowMs: number): TaskStatus {
    if (nowMs < this.startMs) return TaskStatus.Pending;
    if (nowMs >= this.endMs)  return TaskStatus.Complete;
    return TaskStatus.InProgress;
  }
}
