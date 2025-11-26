
import {SDKTask} from "./SDKTask";

export class SDKTaskRunner {

  private tasksByPriority: Map<number, Set<SDKTask>>;
  private running: boolean;

  constructor() {
    this.tasksByPriority = new Map<number, Set<SDKTask>>();
    this.tasksByPriority.set(0, new Set<SDKTask>());
    this.tasksByPriority.set(1, new Set<SDKTask>());
    this.tasksByPriority.set(2, new Set<SDKTask>());
    this.tasksByPriority.set(3, new Set<SDKTask>());
    this.running = false;
  }

  addTask(task: SDKTask): void {
    const priority = Math.max(0, Math.min(2, task.priority || 0));
    this.tasksByPriority.get(priority)!.add(task);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(() => this.runTasks());
    }
  }

  private runTasks(): void {
    let tasksRemain = false;

    for (let priority = 0; priority <= 2; priority++) {
      const tasks = this.tasksByPriority.get(priority)!;
      for (const task of Array.from(tasks)) {
        if (!task.destroyed) {
          task.runIfScheduled();
          if (!task.persistent) {
            tasks.delete(task);
          }
        } else {
          tasks.delete(task);
        }
      }
    }

    tasksRemain = [0, 1, 2].some(p => this.tasksByPriority.get(p)!.size > 0);

    if (tasksRemain) {
      requestAnimationFrame(() => this.runTasks());
    } else {
      this.running = false;
    }
  }
}

const globalTaskRunner = new SDKTaskRunner();

export function getGlobalTaskRunner(): SDKTaskRunner {
  return globalTaskRunner;
}
