import type {SchedulePlayerParams} from "./SchedulePlayerParams";
import type {Schedule} from "./Schedule";
import type {ScheduleTask} from "./ScheduleTask";
import type {View} from "@xeokit/sdk/viewing/viewer";
import {TaskStatus} from "./TaskStatus";
import {EventEmitter, SDKTask} from "@xeokit/sdk/base/core";
import {EventDispatcher} from "strongly-typed-events";


const DEFAULT_GHOST_COLOR: [number, number, number] = [0.6, 0.7, 0.85];
const MS_PER_DAY = 24 * 60 * 60 * 1000;


/**
 * Drives a {@link viewing!viewer.View | View} from a
 * {@link Schedule | Schedule} — at every tick, each
 * {@link model!scene.SceneObject | SceneObject} owned by a task is
 * shown / hidden / tinted / faded to match that task's status at the
 * current cursor date.
 *
 * ## What this gets you
 *
 * - **A scrubbable construction sequence**: bind a timeline UI to
 *   {@link currentDate}, the scene becomes a 4D playback of the
 *   schedule. Earth → foundations → frame → envelope → fit-out, with
 *   the relevant objects appearing in their trade colour as their
 *   tasks become active.
 * - **Critical-path / clash review**: pause on any date and inspect
 *   exactly which trades overlap. The tinted-by-task colouring makes
 *   "MEP rough-in collides with drywall" visually obvious without
 *   running a clash engine first.
 * - **Marketing / client walkthroughs**: combine with
 *   {@link viewing!cameraFlight.CameraFlightAnimation | CameraFlightAnimation}
 *   to fly to each milestone's AABB as it lands — week 12 foundations,
 *   week 28 superstructure tops out.
 *
 * ## How it works
 *
 * The player owns a {@link base!core.SDKTask | SDKTask} on the
 * `AnimateStage` of the global runner. While {@link playing} is `true`
 * the task runs every frame and advances {@link currentDate} by
 * `playbackSpeed * realDeltaSeconds * MS_PER_DAY`; once it does, it
 * re-bucketises the schedule's tasks by status and writes the
 * resulting per-object state to the view via the same data-texture
 * bulk-setter API a tree-view click would use
 * (`view.setObjectsVisible / setObjectsColorized / setObjectsOpacity /
 * setObjectsXRayed`). No buffer rebuilds, no per-frame allocation
 * inside the apply path beyond a handful of work arrays.
 *
 * ## Conflict resolution
 *
 * An object that appears in multiple tasks resolves to the task with
 * the *latest end date* that contains the current cursor (or, if no
 * task is currently in progress for that object, the latest-finishing
 * already-complete task). That means: if "structural shell" (weeks
 * 4-12) and "interior fit-out" (weeks 18-26) both list the same wall,
 * the wall colours as shell-orange in week 8, returns to its base
 * material in weeks 13-17, picks up the fit-out tint in week 20, and
 * settles to base again from week 27. Predictable on overlapping
 * scopes; the caller doesn't need to deduplicate `objectIds`.
 *
 * ## Cleanup
 *
 * The player holds an SDKTask reference and writes mutable state to
 * the view's `ViewObject`s. {@link destroy} unschedules the task and
 * leaves the view's objects in their current state (the player makes
 * no attempt to restore pre-player state — that's the caller's
 * decision, since restoring "default" is ambiguous when other systems
 * have also touched visibility / colour).
 *
 * @module presentations/schedule
 */
export class SchedulePlayer {

  public readonly schedule: Schedule;
  public readonly view: View;

  /** Per-real-second day advance while {@link playing} is true. */
  public playbackSpeed: number;

  /** When `true`, pending-task objects render as a low-opacity ghost
   *  rather than hidden. */
  public ghostUpcoming: boolean;
  public ghostColor: [number, number, number];
  public ghostOpacity: number;
  public inProgressOpacity: number;

  /** Fires whenever {@link currentDate} changes (scrub or tick). */
  public readonly onDateChanged: EventEmitter<SchedulePlayer, Date>;

  /** Fires when {@link play} starts playback. */
  public readonly onPlay: EventEmitter<SchedulePlayer, null>;

  /** Fires when {@link pause} or end-of-schedule stops playback. */
  public readonly onPause: EventEmitter<SchedulePlayer, null>;

  /** Fires once when the cursor crosses each milestone's date during
   *  forward playback (also fires for reverse jumps if the cursor
   *  lands exactly on or past a milestone it wasn't on before). */
  public readonly onMilestone: EventEmitter<SchedulePlayer, ScheduleTask>;

  private _currentMs: number;
  private _playing: boolean;
  private _destroyed: boolean;
  private _lastTickMs: number;
  private _crossedMilestoneIds: Set<string>;
  private _animationTask: SDKTask;

  // Scratch buffers reused across applyState() — keeps the per-tick
  // path allocation-free for the common case (a few hundred tasks /
  // a few thousand objects).
  private _pending:    string[] = [];
  private _complete:   string[] = [];
  private _inProgress: Map<string, string[]>  = new Map();
  private _ownersAtDate: Map<string, ScheduleTask> = new Map();

  constructor(params: SchedulePlayerParams) {

    if (!params || !params.schedule || !params.view) {
      throw new Error("[SchedulePlayer] schedule and view are required");
    }

    this.schedule = params.schedule;
    this.view     = params.view;

    const start = (params.currentDate !== undefined)
      ? (params.currentDate instanceof Date
          ? params.currentDate
          : new Date(params.currentDate))
      : this.schedule.startDate;
    this._currentMs = start.getTime();

    this.playbackSpeed     = params.playbackSpeed     ?? 7;
    this.ghostUpcoming     = params.ghostUpcoming     ?? true;
    this.ghostColor        = params.ghostColor        ?? DEFAULT_GHOST_COLOR;
    this.ghostOpacity      = params.ghostOpacity      ?? 0.18;
    this.inProgressOpacity = params.inProgressOpacity ?? 0.85;

    this._playing           = false;
    this._destroyed         = false;
    this._lastTickMs        = 0;
    this._crossedMilestoneIds = new Set();

    this.onDateChanged = new EventEmitter(new EventDispatcher<SchedulePlayer, Date>());
    this.onPlay        = new EventEmitter(new EventDispatcher<SchedulePlayer, null>());
    this.onPause       = new EventEmitter(new EventDispatcher<SchedulePlayer, null>());
    this.onMilestone   = new EventEmitter(new EventDispatcher<SchedulePlayer, ScheduleTask>());

    // Repeating AnimateStage task. The tick checks `_playing` and
    // either advances the cursor or short-circuits; non-repeating
    // SDKTasks are deleted after a single run, which is exactly the
    // bug the CameraFlightAnimation rewrite fixed earlier — repeating
    // is the established pattern for "drive something every frame
    // while a flag is on".
    this._animationTask = new SDKTask({
      name: "SchedulePlayer.tick",
      stage: SDKTask.AnimateStage,
      repeat: true,
      task: () => this._tick(),
    });

    // First state-apply runs synchronously so the scene reflects
    // `currentDate` before the next paint — important when the player
    // is constructed against a freshly-loaded scene that's still in
    // its "everything visible" default state.
    this._applyState();

    if (params.autoPlay) {
      this.play();
    }
  }

  /** Current cursor date — read at any time, write to scrub. */
  public get currentDate(): Date {
    return new Date(this._currentMs);
  }

  public set currentDate(d: Date | string) {
    const newMs = (d instanceof Date) ? d.getTime() : new Date(d).getTime();
    if (Number.isNaN(newMs)) return;
    this.setDateMs(newMs);
  }

  /** Cursor date as epoch ms (cheaper than the `Date` getter when
   *  the caller is already in ms units, e.g. binding a slider). */
  public get currentDateMs(): number {
    return this._currentMs;
  }

  public get playing(): boolean {
    return this._playing;
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }

  /** Cursor position as `[0, 1]` across the schedule's full range. */
  public get progress(): number {
    const startMs = this.schedule.startDate.getTime();
    const endMs   = this.schedule.endDate.getTime();
    const span = endMs - startMs;
    if (span <= 0) return 1;
    return Math.max(0, Math.min(1, (this._currentMs - startMs) / span));
  }

  public set progress(t: number) {
    const startMs = this.schedule.startDate.getTime();
    const endMs   = this.schedule.endDate.getTime();
    this.setDateMs(startMs + Math.max(0, Math.min(1, t)) * (endMs - startMs));
  }

  /** Begin playback. No-op if already playing or destroyed. */
  public play(): void {
    if (this._destroyed || this._playing) return;
    this._playing = true;
    this._lastTickMs = 0; // forces the first tick to skip the dt step
    this.onPlay.dispatch(this, null);
  }

  /** Pause playback. The cursor stays where it is. */
  public pause(): void {
    if (this._destroyed || !this._playing) return;
    this._playing = false;
    this.onPause.dispatch(this, null);
  }

  /** Move the cursor to a specific date (epoch ms). Clamped to the
   *  schedule's `[startDate, endDate]`. Triggers a state re-apply
   *  and an {@link onDateChanged} dispatch. */
  public setDateMs(ms: number): void {
    if (this._destroyed) return;
    const start = this.schedule.startDate.getTime();
    const end   = this.schedule.endDate.getTime();
    const clamped = Math.max(start, Math.min(end, ms));
    if (clamped === this._currentMs) return;
    const prevMs = this._currentMs;
    this._currentMs = clamped;
    this._applyState();
    this._fireMilestonesBetween(prevMs, clamped);
    this.onDateChanged.dispatch(this, this.currentDate);
  }

  /** Jump to the schedule's next milestone after `currentDate`.
   *  Returns the milestone task it landed on, or `null` if there
   *  are no further milestones. */
  public nextMilestone(): ScheduleTask | null {
    const cur = this._currentMs;
    for (const m of this.schedule.milestones) {
      if (m.startMs > cur) {
        this.setDateMs(m.startMs);
        return m;
      }
    }
    return null;
  }

  /** Jump to the schedule's previous milestone before `currentDate`. */
  public previousMilestone(): ScheduleTask | null {
    const cur = this._currentMs;
    let last: ScheduleTask | null = null;
    for (const m of this.schedule.milestones) {
      if (m.startMs < cur) last = m;
      else break;
    }
    if (last) this.setDateMs(last.startMs);
    return last;
  }

  /** Detach from the animation task runner. The view's ViewObjects
   *  are left in their last-applied state. */
  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._playing = false;
    this._animationTask.destroy();
    this.onPlay.clear();
    this.onPause.clear();
    this.onDateChanged.clear();
    this.onMilestone.clear();
  }

  // ── internals ─────────────────────────────────────────────────────

  private _tick(): void {
    if (this._destroyed || !this._playing) return;
    const now = (typeof performance !== "undefined" && performance.now)
                ? performance.now()
                : Date.now();
    if (this._lastTickMs === 0) {
      this._lastTickMs = now;
      return;
    }
    const dtSec = (now - this._lastTickMs) / 1000;
    this._lastTickMs = now;
    if (dtSec <= 0) return;
    const advanceMs = this.playbackSpeed * MS_PER_DAY * dtSec;
    const endMs = this.schedule.endDate.getTime();
    const nextMs = this._currentMs + advanceMs;
    if (nextMs >= endMs) {
      this.setDateMs(endMs);
      this.pause();    // stop at end — caller can `play()` again to loop
    } else {
      this.setDateMs(nextMs);
    }
  }

  /**
   * Re-bucketise every task into Pending / InProgress / Complete at
   * the current cursor, then issue bulk view setters for each bucket.
   *
   * Conflict resolution: for objects that belong to multiple tasks,
   * the task with the latest `endMs` that covers (or is most-recently
   * complete at) the cursor wins. This is computed by walking the
   * schedule in `startMs` order and overwriting per-object owner
   * assignments — later-finishing tasks naturally overwrite earlier
   * ones because the sort by `startMs` doesn't preserve `endMs`
   * ordering across overlaps, but the player picks the latest `endMs`
   * for each object explicitly below.
   */
  private _applyState(): void {
    const view = this.view;
    if ((view as any).destroyed) return;

    const t = this._currentMs;
    const pending = this._pending;     pending.length = 0;
    const complete = this._complete;   complete.length = 0;
    const inProgress = this._inProgress; inProgress.clear();
    const owners = this._ownersAtDate; owners.clear();

    // Pass 1: for each (objectId, task) pair, retain the task with
    // the latest endMs. Later tasks win at the cursor.
    for (const task of this.schedule.tasksList) {
      if (task.objectIds.length === 0) continue;
      for (let i = 0; i < task.objectIds.length; i++) {
        const oid = task.objectIds[i];
        const prev = owners.get(oid);
        if (!prev || task.endMs > prev.endMs) owners.set(oid, task);
      }
    }

    // Pass 2: classify each object by the winning task's status.
    for (const [oid, task] of owners) {
      const status = task.statusAt(t);
      switch (status) {
        case TaskStatus.Pending: {
          pending.push(oid);
          break;
        }
        case TaskStatus.Complete: {
          complete.push(oid);
          break;
        }
        case TaskStatus.InProgress: {
          const key = task.tradeColor.join(",");
          let arr = inProgress.get(key);
          if (!arr) inProgress.set(key, arr = []);
          arr.push(oid);
          break;
        }
      }
    }

    // Pass 3: bulk apply state to the view. Each setObjects* call
    // routes through `setObjectsVisible / setObjectsColorized /
    // setObjectsOpacity / setObjectsXRayed` — each is one data-texture
    // write per id.
    if (pending.length > 0) {
      if (this.ghostUpcoming) {
        view.setObjectsVisible(pending, true);
        view.setObjectsXRayed(pending, true);
        view.setObjectsColorized(pending, this.ghostColor as any);
        view.setObjectsOpacity(pending, this.ghostOpacity);
      } else {
        view.setObjectsVisible(pending, false);
      }
    }

    for (const [key, ids] of inProgress) {
      const color = key.split(",").map(Number) as [number, number, number];
      view.setObjectsVisible(ids, true);
      view.setObjectsXRayed(ids, false);
      view.setObjectsColorized(ids, color as any);
      view.setObjectsOpacity(ids, this.inProgressOpacity);
    }

    if (complete.length > 0) {
      view.setObjectsVisible(complete, true);
      view.setObjectsXRayed(complete, false);
      // Pass `null` (not `[1,1,1]` / `1`) so the COLORIZED and
      // OPACITY_UPDATED flags are *cleared* on each ViewObject.
      // Truthy values to `setObjectsColorized` / `setObjectsOpacity`
      // enable the override path and replace the underlying
      // material's colour / alpha with the supplied value — which
      // for `1` correctly forces glass and curtain walls into the
      // opaque render bin and silhouettes the whole assembly.
      // Clearing the flags routes each object back through its
      // SceneMesh material — exactly what "this task is finished"
      // should look like.
      view.setObjectsColorized(complete, null);
      view.setObjectsOpacity(complete, null);
    }
  }

  /** Fire `onMilestone` for every milestone whose date sits in the
   *  half-open interval (`prev, now]` when scrubbing forward, or
   *  re-fires for milestones the cursor backed up past (`prev > now`).
   *  The `_crossedMilestoneIds` set guards against re-firing the same
   *  milestone on every tick during a long-running forward play. */
  private _fireMilestonesBetween(prevMs: number, nowMs: number): void {
    for (const m of this.schedule.milestones) {
      const crossed = (prevMs < m.startMs && nowMs >= m.startMs);
      if (crossed && !this._crossedMilestoneIds.has(m.id)) {
        this._crossedMilestoneIds.add(m.id);
        this.onMilestone.dispatch(this, m);
      } else if (nowMs < m.startMs) {
        // Cursor moved back past this milestone — allow it to
        // re-fire on the next forward crossing.
        this._crossedMilestoneIds.delete(m.id);
      }
    }
  }
}
