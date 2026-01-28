/**
 * WorkerPool manages a pool of workers to efficiently handle multiple tasks in parallel.
 * It allows for dynamic worker creation, task queuing, and managing worker utilization.
 *
 * @author Deepkolos / https://github.com/deepkolos
 */
export declare class WorkerPool {
    private pool;
    private queue;
    private workers;
    private workersResolve;
    private workerStatus;
    private workerCreator;
    /**
     * Constructs the WorkerPool instance with a given pool size.
     * @param pool The number of workers in the pool (default is 4).
     */
    constructor(pool?: number);
    /**
     * Initializes a worker by creating it and adding an event listener for messages.
     * @param workerId The ID of the worker to initialize.
     */
    _initWorker(workerId: number): void;
    /**
     * Finds and returns an idle worker by checking the worker status.
     * @returns The index of an idle worker, or -1 if no idle workers are available.
     */
    _getIdleWorker(): number;
    /**
     * Handles messages received from workers.
     * @param workerId The ID of the worker sending the message.
     * @param msg The message received from the worker.
     */
    _onMessage(workerId: number, msg: string): void;
    /**
     * Sets the worker creator function, which is used to create new workers.
     * @param workerCreator The function that creates a new worker.
     */
    setWorkerCreator(workerCreator: any): void;
    /**
     * Sets the limit for the number of workers in the pool.
     * @param pool The new pool size.
     */
    setWorkerLimit(pool: number): void;
    /**
     * Posts a message to an available worker. If no worker is available, the task is queued.
     * @param msg The message to send to the worker.
     * @param transfer Any transferable objects to send with the message.
     * @returns A promise that resolves when the worker finishes processing the message.
     */
    postMessage(msg: any, transfer: any): Promise<unknown>;
    /**
     * Terminates all workers, clears the resolve functions, and resets the pool status.
     * This will effectively destroy the WorkerPool and free up any resources used.
     */
    destroy(): void;
}
//# sourceMappingURL=WorkerPool.d.ts.map
