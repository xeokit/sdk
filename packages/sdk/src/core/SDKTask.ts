
import {getGlobalTaskRunner} from "./SDKTaskRunner";

const taskRunner = getGlobalTaskRunner();

/**
 * A Task represents a unit of work that can be scheduled to run in a specific phase of the SDK's update cycle.
 * Tasks can be persistent (running every frame) or non-persistent (running only when scheduled).
 */
export class SDKTask {

  /**
   * Phase in which Tasks run that handle input updates.
   * @readonly
   */
  public static readonly CollectInputPhase = 0;

  /**
   * Phase in which Tasks run that handle compute updates.
   */
  public static readonly ComputePhase = 1;

  /**
   * Phase in which Tasks run that handle render updates.
   */
  public static readonly RenderPhase = 2;

  /**
   * Phase in which Tasks run that handle post-render updates.
   */
  public static readonly PostRenderPhase = 3;

  /**
   * The function that performs this Task's work.
   */
  public task: ()=>void;

  /**
   * The phase in which this Task runs.
   */
  public phase: number;

  /**
   * Indicates whether this Task has been destroyed.
   */
  public destroyed: boolean;

  /**
   * Indicates whether this Task is currently scheduled to run.
   */
  public scheduled: boolean;

  /**
   * Indicates whether this Task is persistent (runs every frame) or non-persistent (runs only when scheduled).
   */
  public persistent: boolean;

  /**
   * Optional name for this Task, useful for debugging.
   */
  public name?: string;

  /**
   * Creates a new Task.
   *
   * @param params Task parameters.
   * @param params.name Optional name for this Task.
   * @param params.task The function that performs this Task's work.
   * @param params.phase The phase in which this Task runs.
   * @param params.persistent Indicates whether this Task is persistent (runs every frame) or non-persistent (runs only when scheduled).
   * @constructor
   */
  constructor(params: {
    name?: string,
    task: ()=>void,
    phase:number,
    persistent?: boolean
  }) {
    this.name = params.name;
    this.destroyed = false;
    this.scheduled = false;
    this.phase = params.phase;
    this.task = params.task;
    this.persistent = !!params.persistent;
    if (this.persistent) {
      taskRunner.addTask(this);
    }
  }

  /**
   * Flags this Task as having a deferred state update it needs to perform.
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
      this.task();
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

