
import {SDKTask} from "./SDKTask";

export class SDKTaskRunner {

  private tasksByPhase: Map<number, Set<SDKTask>>;
  private running: boolean;

  constructor() {
    this.tasksByPhase = new Map<number, Set<SDKTask>>();
    this.tasksByPhase.set(SDKTask.CollectInputPhase, new Set<SDKTask>());
    this.tasksByPhase.set(SDKTask.ComputePhase, new Set<SDKTask>());
    this.tasksByPhase.set(SDKTask.RenderPhase, new Set<SDKTask>());
    this.tasksByPhase.set(SDKTask.PostRenderPhase, new Set<SDKTask>());
    this.running = false;
  }

  addTask(task: SDKTask): void {
    const phase = Math.max(0, Math.min(2, task.phase || 0));
    this.tasksByPhase.get(phase)!.add(task);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(() => this.runTasks());
    }
  }

  private runTasks(): void {
    let tasksRemain = false;

    for (let phase = 0; phase <= 2; phase++) {
      const tasks = this.tasksByPhase.get(phase)!;
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

    tasksRemain = [
      SDKTask.CollectInputPhase,
      SDKTask.ComputePhase,
      SDKTask.RenderPhase,
      SDKTask.PostRenderPhase
    ].some(p => this.tasksByPhase.get(p)!.size > 0);

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
