import type { Viewer } from "./Viewer";
export interface TickEvent {
    viewerId: string;
    time: number;
    startTime: number;
    prevTime: number;
    deltaTime: number;
}
/**
 * @internal
 */
declare class Scheduler {
    #private;
    readonly viewers: {
        [key: string]: Viewer;
    };
    /**
     * @private
     */
    constructor();
    registerViewer(viewer: Viewer): void;
    deregisterViewer(viewer: Viewer): void;
    scheduleTask(callback: Function, scope: any): void;
    getNumTasks(): number;
}
declare const scheduler: Scheduler;
export { scheduler };
//# sourceMappingURL=scheduler.d.ts.map