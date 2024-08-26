import {Queue, Map, inQuotes} from "@xeokit/utils";

import {stats} from './stats';
import type {Viewer} from "./Viewer";


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
 * @internal
 */
class Scheduler {

    public readonly viewers: { [key: string]: Viewer };

    #viewersRenderInfo: { [key: string]: any } = {};

    // @ts-ignore
    #viewerIDMap: Map = new Map(); // Ensures unique viewer IDs
    #taskQueue: Queue = new Queue(); // Task queue, which is pumped on each frame; tasks are pushed to it with calls to xeokit.schedule
    #taskBudget: number = 10; // Millisecs we're allowed to spend on tasks in each frame
    #lastTime: number = 0;
    #elapsedTime: number = 0;

    /**
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

    #runTasks(time: number) {
        const tasksRun = this.#runTasksUntil(time + this.#taskBudget);
        const tasksScheduled = this.getNumTasks();
        stats.frame.tasksRun = tasksRun;
        stats.frame.tasksScheduled = tasksScheduled;
        stats.frame.tasksBudget = this.#taskBudget;
    }

    #runTasksUntil(until: number = -1) {
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

    #fireTickEvents(time: number) {
        tickEvent.time = time;
        for (let id in scheduler.viewers) {
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

    #renderViewers() {
        for (let id in this.viewers) {
            if (this.viewers.hasOwnProperty(id)) {
                const viewer = this.viewers[id];
                let renderInfo = this.#viewersRenderInfo[id];
                if (!renderInfo) {
                    renderInfo = this.#viewersRenderInfo[id] = {}; // FIXME
                }


                // const ticksPerOcclusionTest = viewer.ticksPerOcclusionTest;
                // if (renderInfo.ticksPerOcclusionTest !== ticksPerOcclusionTest) {
                //     renderInfo.ticksPerOcclusionTest = ticksPerOcclusionTest;
                //     renderInfo.renderCountdown = ticksPerOcclusionTest;
                // }
                // if (--viewer.occlusionTestCountdown <= 0) {
                //     viewer.doOcclusionTest();
                //     viewer.occlusionTestCountdown = ticksPerOcclusionTest;
                // }
                //
                // ticksPerRender = viewer.ticksPerRender;
                // if (renderInfo.ticksPerRender !== ticksPerRender) {
                //     renderInfo.ticksPerRender = ticksPerRender;
                //     renderInfo.renderCountdown = ticksPerRender;
                // }
                // if (--renderInfo.renderCountdown === 0) {
                    viewer.render({});
                //     renderInfo.renderCountdown = ticksPerRender;
                // }
            }
        }
    }

    registerViewer(viewer: Viewer) {
        if (viewer.id) {
            if (this.viewers[viewer.id]) {
                console.error(`[ERROR] Viewer ${inQuotes(viewer.id)} already exists`);
                return;
            }
        } else { // Auto-generated ID
            // @ts-ignore
            // noinspection JSConstantReassignment
            viewer.id = this.#viewerIDMap.addItem({});
        }
        this.viewers[viewer.id] = viewer;
        // const ticksPerOcclusionTest = viewer.ticksPerOcclusionTest;
        // const ticksPerRender = viewer.ticksPerRender;
        this.#viewersRenderInfo[viewer.id] = {
            // ticksPerOcclusionTest: ticksPerOcclusionTest,
            // ticksPerRender: ticksPerRender,
            // renderCountdown: ticksPerRender
        };
        stats.components.viewers++;
    }

    deregisterViewer(viewer:Viewer) {
        if (!this.viewers[viewer.id]) {
            return;
        }
        this.#viewerIDMap.removeItem(viewer.id);
        delete this.viewers[viewer.id];
        delete this.#viewersRenderInfo[viewer.id];
        stats.components.viewers--;
    }

    scheduleTask(callback: Function, scope: any) {
        this.#taskQueue.push(callback);
        this.#taskQueue.push(scope);
    }

    getNumTasks() {
        return this.#taskQueue.length;
    }
}

const scheduler = new Scheduler();

export {scheduler};
