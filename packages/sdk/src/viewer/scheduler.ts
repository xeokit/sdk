
import { inQuotes, Map, Queue } from "../utils";
import { stats } from './stats';
import type { Viewer } from "./Viewer";

/**
 * Event object dispatched on each animation frame.
 */
export interface TickEvent {
  viewerId: string;
  time: number;
  startTime: number;
  prevTime: number;
  deltaTime: number;
}

const tickEvent: TickEvent = {
  viewerId: "",
  time: 0,
  startTime: 0,
  prevTime: 0,
  deltaTime: 0
};

/**
 * Manages animation frames, per-frame task execution, and rendering of registered Viewers.
 * @internal
 */
export class Scheduler {

  /**
   * Registered Viewer instances, keyed by their IDs.
   */
  public readonly viewers: { [key: string]: Viewer };

  #viewersRenderInfo: { [key: string]: any } = {};
  #viewerIDMap: Map = new Map(); // Ensures unique viewer IDs
  #taskQueue: Queue = new Queue(); // Queue of scheduled tasks
  #taskBudget: number = 10; // Max time in ms to spend on tasks per frame
  #lastTime: number = 0;
  #elapsedTime: number = 0;

  /**
   * Creates a new Scheduler that begins executing tasks and rendering Viewers on animation frames.
   *
   * @private
   */
  constructor() {
    this.viewers = {};

    const frame = () => {
      const time = Date.now();
      if (this.#lastTime > 0) {
        this.#elapsedTime = time - this.#lastTime;
      }
      this.#runTasks(time);
      this.#fireTickEvents(time);
      this.#renderViewers();
      this.#lastTime = time;

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }

  /**
   * Executes queued tasks within the allowed task budget.
   *
   * @param time Current frame time in ms.
   */
  #runTasks(time: number) {
    const tasksRun = this.#runTasksUntil(time + this.#taskBudget);
    const tasksScheduled = this.getNumTasks();
    stats.frame.tasksRun = tasksRun;
    stats.frame.tasksScheduled = tasksScheduled;
    stats.frame.tasksBudget = this.#taskBudget;
  }

  /**
   * Executes tasks from the queue until a given deadline or until the queue is empty.
   *
   * @param until Timestamp (ms) to stop executing tasks.
   * @returns Number of tasks executed.
   */
  #runTasksUntil(until: number = -1): number {
    let time = (new Date()).getTime();
    let tasksRun = 0;
    while (this.#taskQueue.length > 0 && (until < 0 || time < until)) {
      const callback = this.#taskQueue.shift();
      const scope = this.#taskQueue.shift();
      if (scope) {
        callback.call(scope);
      } else {
        callback();
      }
      time = (new Date()).getTime();
      tasksRun++;
    }
    return tasksRun;
  }

  /**
   * Dispatches tick events to all registered Viewers.
   *
   * @param time Current time in ms.
   */
  #fireTickEvents(time: number) {
    tickEvent.time = time;
    for (const id in scheduler.viewers) {
      if (this.viewers.hasOwnProperty(id)) {
        const viewer = this.viewers[id];
        tickEvent.viewerId = id;
        tickEvent.startTime = viewer.startTime;
        tickEvent.deltaTime = tickEvent.prevTime != null ? tickEvent.time - tickEvent.prevTime : 0;
        viewer.onTick.dispatch(viewer, tickEvent);
      }
    }
    tickEvent.prevTime = time;
  }

  /**
   * Renders all registered Viewers.
   */
  #renderViewers() {
    for (const id in this.viewers) {
      if (this.viewers.hasOwnProperty(id)) {
        const viewer = this.viewers[id];
        let renderInfo = this.#viewersRenderInfo[id];
        if (!renderInfo) {
          renderInfo = this.#viewersRenderInfo[id] = {};
        }

        viewer.render({});
      }
    }
  }

  /**
   * Registers a Viewer with the Scheduler for tick and render updates.
   *
   * @param viewer Viewer to register.
   */
  registerViewer(viewer: Viewer) {
    if (viewer.id) {
      if (this.viewers[viewer.id]) {
        console.error(`[ERROR] Viewer ${inQuotes(viewer.id)} already exists`);
        return;
      }
    } else {
      // @ts-ignore
      // noinspection JSConstantReassignment
      viewer.id = this.#viewerIDMap.addItem({});
    }
    this.viewers[viewer.id] = viewer;
    this.#viewersRenderInfo[viewer.id] = {};
    stats.components.viewers++;
  }

  /**
   * Deregisters a Viewer, stopping tick and render updates.
   *
   * @internal
   * @param viewer Viewer to deregister.
   */
  deregisterViewer(viewer: Viewer) {
    if (!this.viewers[viewer.id]) {
      return;
    }
    this.#viewerIDMap.removeItem(viewer.id);
    delete this.viewers[viewer.id];
    delete this.#viewersRenderInfo[viewer.id];
    stats.components.viewers--;
  }

  /**
   * Schedules a task to be executed on an upcoming animation frame.
   *
   * @param callback Function to execute.
   * @param scope Optional scope to call the function in.
   */
  scheduleTask(callback: Function, scope: any) {
    this.#taskQueue.push(callback);
    this.#taskQueue.push(scope);
  }

  /**
   * Gets the number of tasks currently scheduled.
   *
   * @returns Number of queued tasks.
   */
  getNumTasks(): number {
    return this.#taskQueue.length;
  }
}

/**
 * Singleton Scheduler instance that manages all rendering and task execution.
 */
const scheduler = new Scheduler();

export { scheduler };

