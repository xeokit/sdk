import { SDKTask } from "./SDKTask";

/**
 * Coordinates scheduling and execution of {@link SDKTask} instances
 * across the SDK's update cycle.
 *
 * Tasks are grouped by stage and may run:
 * - **once**, when explicitly scheduled
 * - **repeatedly**, if marked as repeating
 *
 * The runner is responsible for:
 * - adding tasks to the appropriate stage queue
 * - invoking tasks at the correct point in the update loop
 * - cleaning up destroyed or completed tasks
 *
 * A single {@link SDKTaskRunner} instance typically drives the entire
 * application via the global runner provided by {@link getGlobalTaskRunner}.
 */
export class SDKTaskRunner {

  /**
   * Maps each stage to its active set of tasks.
   * Stages correspond to the static constants on {@link SDKTask}.
   */
  private tasksByStage: Map<number, Set<SDKTask>>;

  /**
   * Whether the runner is currently processing a task loop.
   * Used to avoid starting multiple animation-frame loops.
   */
  private running: boolean;

  private suspended: boolean = false;
  private pendingTasks: SDKTask[] = [];

  constructor() {
    this.tasksByStage = new Map<number, Set<SDKTask>>();
    this.tasksByStage.set(0, new Set<SDKTask>());
    this.tasksByStage.set(1, new Set<SDKTask>());
    this.tasksByStage.set(2, new Set<SDKTask>());
    this.tasksByStage.set(3, new Set<SDKTask>());
    this.tasksByStage.set(4, new Set<SDKTask>());
    this.tasksByStage.set(5, new Set<SDKTask>());
    this.running = false;
    this.suspended = false;
  }

  /**
   * Suspends the runner. Tasks added while suspended are queued and not executed until unsuspend() is called.
   */
  public suspend(): void {
    this.suspended = true;
    this.running = false;
  }

  /**
   * Unsuspends the runner. All tasks added while suspended are registered and the runner resumes.
   */
  public unsuspend(): void {
    this.suspended = false;
    for (const task of this.pendingTasks) {
      this._addTaskInternal(task);
    }
    this.pendingTasks = [];
    // Start loop if needed
    if (!this.running && this.hasTasks()) {
      this.running = true;
      requestAnimationFrame(() => this.runTasks());
    }
  }

  /**
   * Registers a task with the runner so it can be executed during updates.
   *
   * Adding a non-repeating task does not guarantee immediate execution;
   * it will run only when scheduled (see {@link SDKTask.schedule}).
   *
   * Repeating tasks are automatically executed every frame once added.
   *
   * @param task The task to register.
   */
  public addTask(task: SDKTask): void {
    if (this.suspended) {
      this.pendingTasks.push(task);
      return;
    }
    this._addTaskInternal(task);
  }

  private _addTaskInternal(task: SDKTask): void {
    const stage = Math.max(0, Math.min(5, task.stage || 0));
    this.tasksByStage.get(stage)!.add(task);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(() => this.runTasks());
    }
  }

  /**
   * Internal update loop. Invoked via `requestAnimationFrame`.
   *
   * For each stage:
   * - runs tasks if they are scheduled or repeating
   * - removes non-repeating tasks after execution
   * - removes destroyed tasks
   *
   * Continues running on subsequent animation frames until no tasks remain.
   */
  private runTasks(): void {
    if (this.suspended) {
      return;
    }
    let tasksRemain = false;
    for (let stage = 0; stage <= 5; stage++) {
      const tasks = this.tasksByStage.get(stage)!;
      for (const task of Array.from(tasks)) {
        if (!task.destroyed) {
          task.runIfScheduled();
          if (!task.repeating) {
            tasks.delete(task);
          }
        } else {
          tasks.delete(task);
        }
      }
    }

    // Determine whether to keep the loop alive
    tasksRemain = [
      SDKTask.CollectInputStage,
      SDKTask.AnimateStage,
      SDKTask.ComputeStage,
      SDKTask.ComputeStage2,
      SDKTask.RenderStage,
      SDKTask.PostRenderStage
    ].some(stage => this.tasksByStage.get(stage)!.size > 0);

    if (tasksRemain) {
      requestAnimationFrame(() => this.runTasks());
    } else {
      this.running = false;
    }
  }

  private hasTasks(): boolean {
    for (let stage = 0; stage <= 5; stage++) {
      if (this.tasksByStage.get(stage)!.size > 0) return true;
    }
    return false;
  }
}



const globalTaskRunner = new SDKTaskRunner();

/**
 * Returns the global, shared {@link SDKTaskRunner} instance used
 * by default for all {@link SDKTask} objects.
 *
 * The global runner manages all tasks not assigned a custom runner.
 *
 * @returns The global {@link SDKTaskRunner} instance.
 */
export function getGlobalTaskRunner(): SDKTaskRunner {
  return globalTaskRunner;
}
