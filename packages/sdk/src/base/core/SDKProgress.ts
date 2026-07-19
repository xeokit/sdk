import {EventEmitter} from "./EventEmitter";
import {EventDispatcher} from "strongly-typed-events";

/**
 * Class for tracking progress of asynchronous tasks in the SDK.
 */
export class SDKProgress {

  public onTasksAdded: EventEmitter<SDKProgress, number>;
  public onTaskCompleted: EventEmitter<SDKProgress, number>;
  public onPhaseUpdated: EventEmitter<SDKProgress, string>;
  public numTasks = 0;
  public phase = "Booting example";

  constructor() {
    this.onTasksAdded = new EventEmitter(new EventDispatcher<SDKProgress, number>());
    this.onTaskCompleted = new EventEmitter(new EventDispatcher<SDKProgress, number>());
    this.onPhaseUpdated = new EventEmitter(new EventDispatcher<SDKProgress, string>());
    this.numTasks = 0;
  }

  public addTask(): void {
    this.numTasks++;
    this.onTasksAdded.dispatch(this, 1);
  }

  public addTasks(count: number): void {
    if (count > 0) {
      this.numTasks += count;
      this.onTasksAdded.dispatch(this,count);
    }
  }

  public completeTask(): void {
    if (this.numTasks > 0) {
      this.numTasks--;
      this.onTaskCompleted.dispatch(this, this.numTasks);
    }
  }

  public setPhase(phase: string): void {
    this.phase = phase;
    this.onPhaseUpdated.dispatch(this, phase);
  }
}

export const sdkProgress = new SDKProgress();
