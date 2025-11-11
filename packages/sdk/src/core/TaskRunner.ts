import {Task} from "./Task";

/**
 * Runs xeokit SDK Tasks on animation frames.
 */
export class TaskRunner {

  private tasks: Set<Task>;
  private running: boolean;

    /**
     * Creates a new TaskRunner.
     */
    constructor() {
      this.tasks = new Set<Task>();
      this.running = false;
    }

    /**
     * Adds a Task to be run.
     * @param task The Task to add.
     */
    addTask(task: Task): void {
      this.tasks.add(task);
      if (!this.running) {
        this.running = true;
        requestAnimationFrame(() => this.runTasks());
      }
    }

    /**
     * Runs all added Tasks.
     */
    private runTasks(): void {
      this.tasks.forEach((task) => {
        if (!task.destroyed) {
          task.cleanIfDirty();
        } else {
          this.tasks.delete(task);
        }
      });
      if (this.tasks.size > 0) {
        requestAnimationFrame(() => this.runTasks());
      } else {
        this.running = false;
      }
    }
}

const globalTaskRunner = new TaskRunner();

/**
 * Gets the global TaskRunner.
 */
export function getGlobalTaskRunner(): TaskRunner {
  return globalTaskRunner;
}