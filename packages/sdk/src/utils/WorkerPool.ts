/**
 * WorkerPool manages a pool of workers to efficiently handle multiple tasks in parallel.
 * It allows for dynamic worker creation, task queuing, and managing worker utilization.
 *
 * @author Deepkolos / https://github.com/deepkolos
 */
export class WorkerPool {
  private pool: number; // The maximum number of workers in the pool.
  private queue: any[]; // The task queue, holds tasks when no idle workers are available.
  private workers: any[]; // The list of workers currently in the pool.
  private workersResolve: any[]; // The list of resolve functions, one for each worker.
  private workerStatus: number; // A bitmask representing the status of each worker (idle or busy).
  private workerCreator: any; // A function to create new workers.

  /**
   * Constructs the WorkerPool instance with a given pool size.
   * @param pool The number of workers in the pool (default is 4).
   */
  constructor(pool = 4) {
    this.pool = pool; // Set the pool size.
    this.queue = []; // Initialize the queue to empty.
    this.workers = []; // Initialize the workers array to empty.
    this.workersResolve = []; // Initialize the workers resolve array to empty.
    this.workerStatus = 0; // Initialize the worker status to 0 (all workers are idle).
  }

  /**
   * Initializes a worker by creating it and adding an event listener for messages.
   * @param workerId The ID of the worker to initialize.
   */
  _initWorker(workerId: number) {
    // If the worker doesn't already exist, create a new worker.
    if (!this.workers[workerId]) {
      const worker = this.workerCreator(); // Create a new worker using the workerCreator function.
      worker.addEventListener('message', this._onMessage.bind(this, workerId)); // Set up message handler.
      this.workers[workerId] = worker; // Add the worker to the pool.
    }
  }

  /**
   * Finds and returns an idle worker by checking the worker status.
   * @returns The index of an idle worker, or -1 if no idle workers are available.
   */
  _getIdleWorker() {
    // Check each worker to see if it's idle (not in use).
    for (let i = 0; i < this.pool; i++)
      if (!(this.workerStatus & (1 << i))) return i; // Return the first idle worker.
    return -1; // Return -1 if no idle workers are found.
  }

  /**
   * Handles messages received from workers.
   * @param workerId The ID of the worker sending the message.
   * @param msg The message received from the worker.
   */
  _onMessage(workerId: number, msg: string) {
    const resolve = this.workersResolve[workerId]; // Get the resolve function for this worker.
    resolve && resolve(msg); // Resolve the promise with the message received from the worker.

    // If there are tasks in the queue, send the next one to this worker.
    if (this.queue.length) {
      const {resolve, msg, transfer} = this.queue.shift(); // Get the next task from the queue.
      this.workersResolve[workerId] = resolve; // Assign the resolve function.
      this.workers[workerId].postMessage(msg, transfer); // Send the task to the worker.
    } else {
      this.workerStatus ^= 1 << workerId; // Mark the worker as idle by updating the worker status.
    }
  }

  /**
   * Sets the worker creator function, which is used to create new workers.
   * @param workerCreator The function that creates a new worker.
   */
  setWorkerCreator(workerCreator: any) {
    this.workerCreator = workerCreator; // Set the workerCreator function.
  }

  /**
   * Sets the limit for the number of workers in the pool.
   * @param pool The new pool size.
   */
  setWorkerLimit(pool: number) {
    this.pool = pool; // Set the new pool size.
  }

  /**
   * Posts a message to an available worker. If no worker is available, the task is queued.
   * @param msg The message to send to the worker.
   * @param transfer Any transferable objects to send with the message.
   * @returns A promise that resolves when the worker finishes processing the message.
   */
  postMessage(msg: any, transfer: any) {
    return new Promise((resolve) => {
      const workerId = this._getIdleWorker(); // Find an idle worker.

      if (workerId !== -1) { // If there's an idle worker, send the message.
        this._initWorker(workerId); // Initialize the worker if not already initialized.
        this.workerStatus |= 1 << workerId; // Mark the worker as busy.
        this.workersResolve[workerId] = resolve; // Store the resolve function for this worker.
        this.workers[workerId].postMessage(msg, transfer); // Send the message to the worker.
      } else {
        this.queue.push({resolve, msg, transfer}); // If no idle worker, queue the task.
      }
    });
  }

  /**
   * Terminates all workers, clears the resolve functions, and resets the pool status.
   * This will effectively destroy the WorkerPool and free up any resources used.
   */
  destroy() {
    // Terminate each worker in the pool.
    this.workers.forEach((worker) => worker.terminate());
    this.workersResolve.length = 0; // Clear the resolve functions.
    this.workers.length = 0; // Clear the workers array.
    this.queue.length = 0; // Clear the task queue.
    this.workerStatus = 0; // Reset the worker status to 0 (all idle).
  }
}
