/**
 * @author Deepkolos / https://github.com/deepkolos
 */
export declare class WorkerPool {
    private pool;
    private queue;
    private workers;
    private workersResolve;
    private workerStatus;
    private workerCreator;
    constructor(pool?: number);
    _initWorker(workerId: number): void;
    _getIdleWorker(): number;
    _onMessage(workerId: number, msg: string): void;
    setWorkerCreator(workerCreator: any): void;
    setWorkerLimit(pool: number): void;
    postMessage(msg: any, transfer: any): Promise<unknown>;
    destroy(): void;
}
