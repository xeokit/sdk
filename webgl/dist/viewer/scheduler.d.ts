import type { WebViewer } from "./WebViewer";
export interface TickEvent {
    viewerId: string;
    time: number;
    startTime: number;
    prevTime: number;
    deltaTime: number;
}
declare class Scheduler {
    #private;
    readonly viewers: {
        [key: string]: WebViewer;
    };
    /**
     * @private
     */
    constructor();
    registerViewer(viewer: WebViewer): void;
    deregisterViewer(viewer: WebViewer): void;
    scheduleTask(callback: Function, scope: any): void;
    getNumTasks(): number;
}
declare const scheduler: Scheduler;
export { scheduler };
