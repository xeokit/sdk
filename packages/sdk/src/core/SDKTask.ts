
import {getGlobalTaskRunner} from "./SDKTaskRunner";

const taskRunner = getGlobalTaskRunner();

/**
 * Common base class for xeokit SDK Tasks.
 */
export class SDKTask {

  /**
   * Phase 0 priority for Tasks.
   * Viewer uses this phase for recalculating foundational state, such as world matrices.
   * Tasks with this priority run before phases 1, 2, and 3.
   * @readonly
   */
  public static readonly PHASE_0 = 0;

  /**
   * Phase 1 priority for Tasks.
   * Viewer uses this to notify whenever a view is ready to be rendered.
   */
  public static readonly PHASE_1 = 1;

  /**
   * Phase 2 priority for Tasks.
   */
  public static readonly PHASE_2 = 2;

  /**
   * Phase 3 priority for Tasks.
   */
  public static readonly PHASE_3 = 3;

  public priority: number;
  public clean: ()=>void;
  public destroyed: boolean;
  public scheduled: boolean;
  public persistent: boolean;

  /**
   * Creates a new Task.
   */
  constructor(clean: ()=>void, priority:number, persistent: boolean = false) {
    this.destroyed = false;
    this.scheduled = false;
    this.priority = priority;
    this.clean = clean;
    this.persistent = persistent;
    if (this.persistent) {
      taskRunner.addTask(this);
    }
  }

  /**
   * Flags this Task as having a deferred state updates it needs to perform.
   */
  public schedule(): void {
    if (this.destroyed) {
      return;
    }
    if (!this.scheduled) {
      this.scheduled = true;
      if (!this.persistent) {
        taskRunner.addTask(this);
      }
    }
  }

  /**
   * Gives this Task an opportunity to action any deferred state updates.
   */
  public runIfScheduled(): void {
    if (this.destroyed) {
      return;
    }
    if (this.scheduled || this.persistent) {
      this.clean();
      this.scheduled = false;
    }
  }

  /**
   * Destroys this Task.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scheduled = false;
  }
}

