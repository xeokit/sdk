
import {getGlobalTaskRunner} from "./TaskRunner";

const taskRunner = getGlobalTaskRunner();

/**
 * Common base class for xeokit SDK Tasks.
 */
export class Task {

  public clean: ()=>void;
  public destroyed: boolean;
  public dirty: boolean;

  /**
   * Creates a new Task.
   */
  constructor(clean: ()=>void) {
    this.destroyed = false;
    this.dirty = false;
    this.clean = clean;
  }

  /**
   * Flags this Task as having a deferred state updates it needs to perform.
   */
  public setDirty(): void {
    if (!this.dirty) {
      this.dirty = true;
        taskRunner.addTask(this);
    }
  }

  /**
   * Gives this Task an opportunity to action any deferred state updates.
   */
  public cleanIfDirty(): void {
    if (this.dirty) {
      this.clean();
      this.dirty = false;
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
    this.dirty = false;
  }
}

