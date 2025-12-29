import { getGlobalTaskRunner, SDKTaskRunner } from "./SDKTaskRunner";

const taskRunner = getGlobalTaskRunner();

/**
 * Represents a unit of work that can be scheduled to run during a specific
 * stage of the SDK's update cycle.
 *
 * Tasks may be:
 * - **repeating** — automatically executed every update cycle
 * - **non-repeating** — executed only when explicitly scheduled
 *
 * A task is managed by an {@link SDKTaskRunner}, which handles scheduling
 * and invoking tasks at their designated stage.
 *
 * ## Example
 *
 * ```typescript
 *
 * // Create a repeating task within the
 * // input collection stage of the SDK's update cycle. The task
 * // will run automatically every update cycle.
 *
 * const myTask = new SDKTask({
 *   name: "MyTask",
 *   stage: SDKTask.CollectInputStage,
 *   task: () => {
 *     console.log("Running my task");
 *   },
 *   repeat: true
 * });
 *
 * // Schedule a non-repeating task within the
 * // animation stage of the SDK's update cycle.
 *
 * const oneTimeTask = new SDKTask({
 *   name: "OneTimeTask",
 *   stage: SDKTask.AnimateStage,
 *   task: () => {
 *     console.log("Running one-time task");
 *   },
 *   repeat: false
 * });
 *
 * // Manually schedule the one-time task to run. We can also
 * // reschedule it later if needed.
 * oneTimeTask.schedule();
 * ```
 *
 * * @see SDKTaskRunner
 */
export class SDKTask {

  /**
   * Stage at which tasks handle input collection or preprocessing.
   * @readonly
   */
  public static readonly CollectInputStage = 0;

  /**
   * Stage at which tasks perform animation updates.
   * @readonly
   */
  public static readonly AnimateStage = 1;

  /**
   * Stage at which tasks perform compute or simulation work.
   * @readonly
   */
  public static readonly ComputeStage = 2;

  /**
   * Stage at which tasks perform rendering-related updates.
   * @readonly
   */
  public static readonly RenderStage = 3;

  /**
   * Stage at which tasks run after rendering is complete.
   * @readonly
   */
  public static readonly PostRenderStage = 4;

  /**
   * The function invoked when this task is executed.
   * Implementations should be side-effecting and synchronous.
   */
  public task: () => void;

  /**
   * The update stage in which this task should run.
   * Must be one of the static stage constants.
   */
  public stage: number;

  /**
   * Whether this task has been destroyed and should no longer run.
   */
  public destroyed: boolean;

  /**
   * Whether this task is currently scheduled to run.
   * Non-repeating tasks must be scheduled before they will execute.
   */
  public scheduled: boolean;

  /**
   * If `true`, this task runs every update cycle without needing
   * to be manually scheduled.
   */
  public repeating: boolean;

  /**
   * Optional human-readable identifier useful for debugging and profiling.
   */
  public name?: string;

  /**
   * The {@link SDKTaskRunner} responsible for managing this task.
   */
  public taskRunner: SDKTaskRunner;

  /**
   * Creates a new {@link SDKTask}.
   *
   * @param params Configuration options for the task.
   * @param params.name Optional display name for debugging.
   * @param params.task The function to execute when the task runs.
   * @param params.stage The update stage in which this task should run.
   * @param params.repeat If `true`, the task will run every update cycle.
   * @param params.taskRunner Optional task runner; defaults to the global runner.
   */
  constructor(params: {
    name?: string;
    task: () => void;
    stage: number;
    repeat?: boolean;
    taskRunner?: SDKTaskRunner;
  }) {
    this.name = params.name;
    this.destroyed = false;
    this.scheduled = false;
    this.stage = params.stage;
    this.task = params.task;
    this.repeating = !!params.repeat;
    this.taskRunner = params.taskRunner || taskRunner;

    // Repeating tasks are always registered immediately.
    if (this.repeating) {
      this.taskRunner.addTask(this);
    }
  }

  /**
   * Schedules this task to run during its update stage.
   *
   * Non-repeating tasks must be scheduled to execute,
   * while repeating tasks ignore manual scheduling.
   */
  public schedule(): void {
    if (this.destroyed) {
      return;
    }
    if (!this.scheduled) {
      this.scheduled = true;
      if (!this.repeating) {
        this.taskRunner.addTask(this);
      }
    }
  }

  /**
   * Called internally by {@link SDKTaskRunner} to execute this task
   * if it is scheduled or if it is repeating.
   */
  public runIfScheduled(): void {
    if (this.destroyed) {
      return;
    }
    if (this.scheduled || this.repeating) {
      this.scheduled = false;
      this.task();
    }
  }

  /**
   * Unschedules this task, preventing it from running.
   * Ignores repeating tasks.
   */
  public unschedule(): void {
    if (this.destroyed) {
      return;
    }
    this.scheduled = false;
  }

  /**
   * Permanently destroys this task.
   *
   * A destroyed task:
   * - will no longer be scheduled,
   * - will no longer run,
   * - releases its reference to the task runner.
   */
  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scheduled = false;
    this.taskRunner = null;
  }
}

