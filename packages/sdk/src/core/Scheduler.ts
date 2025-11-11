/*
 * Scheduler.ts
 *
 * A tiny, TypeDoc-friendly singleton that manages a requestAnimationFrame-based game loop.
 * It now supports **pre-tick**, **tick**, and **post-tick** stages with both recurring
 * subscribers and one-shot tasks that run on the very next loop.
 *
 * **Performance/GC notes**
 * - No per-frame array allocations (double-buffered next-task queues; in-place clears).
 * - Subscriber removals use tombstones with periodic compaction; unsubscribes are O(1).
 * - Tight `for` loops instead of iterator helpers to reduce overhead.
 * - No copying subscriber arrays during iteration (mutation-safe via tombstones).
 * - Optional FPS throttle remains lightweight.
 */

/**
 * Represents a function scheduled to run on the next loop. It can optionally
 * accept (dt, now) for timing-aware logic.
 */
export type NextTask = (dt?: number, now?: number) => void;

/**
 * A recurring subscriber function that will be called on every loop stage.
 */
export type Subscriber = (dt: number, now: number) => void;

/** Options for configuring the game loop. */
export interface GameLoopOptions {
    /** Max frames per second. If set, throttles to this FPS. */
    maxFps?: number;
    /** Autostart the loop upon first access. Default: true. */
    autostart?: boolean;
}

/**
 * A lightweight singleton that manages a render/update loop with three stages:
 * - **pre-tick**: runs before the main tick
 * - **tick**: the main per-frame stage
 * - **post-tick**: runs after the main tick
 *
 * Each stage supports recurring **subscribers** and one-shot **next-tasks**.
 */
export class Scheduler {
    /** The singleton instance. */
    private static _instance: Scheduler | null = null;

    /** Access the singleton instance, creating it if necessary. */
    public static get instance(): Scheduler {
        if (!this._instance) this._instance = new Scheduler();
        return this._instance;
    }

    /** Current options used by the loop. (mutable to allow reconfigure) */
    public options: { autostart: boolean; maxFps?: number };

    private _running = false;
    private _rafId: number | null = null;
    private _lastTime = 0;
    private _accumulator = 0;
    private _frameInterval = 0; // in ms; derived from maxFps

    // Recurring subscribers per stage (with tombstones to avoid splices)
    private _preSubs: (Subscriber | null)[] = [];
    private _tickSubs: (Subscriber | null)[] = [];
    private _postSubs: (Subscriber | null)[] = [];
    private _preDead = 0; // tombstone counters for periodic compaction
    private _tickDead = 0;
    private _postDead = 0;

    // One-shot tasks per stage (double-buffered: write to W, read+flush from R)
    private _nextPreA: NextTask[] = []; private _nextPreB: NextTask[] = []; private _preWriteA = true;
    private _nextTickA: NextTask[] = []; private _nextTickB: NextTask[] = []; private _tickWriteA = true;
    private _nextPostA: NextTask[] = []; private _nextPostB: NextTask[] = []; private _postWriteA = true;

    private constructor(opts?: GameLoopOptions) {
        const { autostart = true, maxFps } = opts ?? {};
        this.options = { autostart, maxFps };
        this._frameInterval = maxFps && maxFps > 0 ? 1000 / maxFps : 0;

        if (this.options.autostart) this.start();
    }

    /** Reconfigure the loop at runtime. */
    public configure(opts: GameLoopOptions): void {
        if (typeof opts.maxFps !== "undefined") {
            this.options.maxFps = opts.maxFps;
            this._frameInterval = opts.maxFps && opts.maxFps > 0 ? 1000 / opts.maxFps : 0;
        }
        if (typeof opts.autostart !== "undefined") this.options.autostart = opts.autostart;
    }

    /** Returns whether the loop is currently running. */
    public get running(): boolean { return this._running; }

    /** Starts the game loop. No-op if already running. */
    public start(): void {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        this._tick(this._lastTime);
    }

    /** Stops the game loop. Safe to call multiple times. */
    public stop(): void {
        this._running = false;
        if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    }

    // ===== Stage subscriptions (recurring every frame) =====

    /** Subscribe to the PRE stage (runs before TICK). */
    public subscribePre(sub: Subscriber): () => void { return this._addSubscriber(this._preSubs, sub, "pre"); }
    /** Subscribe to the main TICK stage. */
    public subscribeTick(sub: Subscriber): () => void { return this._addSubscriber(this._tickSubs, sub, "tick"); }
    /** Alias for subscribeTick. */
    public subscribe(sub: Subscriber): () => void { return this.subscribeTick(sub); }
    /** Subscribe to the POST stage (runs after TICK). */
    public subscribePost(sub: Subscriber): () => void { return this._addSubscriber(this._postSubs, sub, "post"); }

    private _addSubscriber(bucket: (Subscriber | null)[], sub: Subscriber, stage: "pre"|"tick"|"post"): () => void {
        if (typeof sub !== "function") throw new TypeError("subscriber must be a function");
        const idx = bucket.push(sub) - 1;
        let removed = false;
        return () => {
            if (removed) return; removed = true;
            if (bucket[idx] !== null) {
                bucket[idx] = null; // tombstone; no splice
                if (stage === "pre") ++this._preDead; else if (stage === "tick") ++this._tickDead; else ++this._postDead;
            }
        };
    }

    // ===== One-shot next-frame tasks per stage =====

    /** Queue a one-off task for the PRE stage of the next frame. */
    public onNextPreTick(task: NextTask): () => void { return this._addNextTask(this._preWriteA ? this._nextPreA : this._nextPreB, task); }
    /** Queue a one-off task for the TICK stage of the next frame. */
    public onNextTick(task: NextTask): () => void { return this._addNextTask(this._tickWriteA ? this._nextTickA : this._nextTickB, task); }
    /** Queue a one-off task for the POST stage of the next frame. */
    public onNextPostTick(task: NextTask): () => void { return this._addNextTask(this._postWriteA ? this._nextPostA : this._nextPostB, task); }
    /** @deprecated Use {@link onNextTick} instead. */
    public onNextLoop(task: NextTask): () => void { return this.onNextTick(task); }

    private _addNextTask(bucket: NextTask[], task: NextTask): () => void {
        if (typeof task !== "function") throw new TypeError("onNext* expects a function");
        const idx = bucket.push(task) - 1;
        let cancelled = false;
        return () => {
            if (cancelled) return; cancelled = true;
            if (bucket[idx] === task) bucket[idx] = emptyTask; // tombstone
        };
    }

    // ===== Internal execution helpers =====

    private _runSubscribers(subs: (Subscriber | null)[], dt: number, now: number): void {
        for (let i = 0, n = subs.length; i < n; i++) {
            const fn = subs[i];
            if (fn !== null) {
                try { fn(dt, now); } catch (err) { console.error("Scheduler subscriber error:", err); }
            }
        }
    }

    private _flushNextTasks(tasks: NextTask[], dt: number, now: number): void {
        for (let i = 0, n = tasks.length; i < n; i++) {
            const t = tasks[i];
            try { (t as any)(dt, now); } catch (err) { console.error("Scheduler next-task error:", err); }
        }
        // in-place clear without realloc
        tasks.length = 0;
    }

    /** The main RAF callback. */
    private _tick = (now: number): void => {
        if (!this._running) return;

        const dt = now - this._lastTime;
        this._lastTime = now;

        // Throttle if maxFps is set
        if (this._frameInterval > 0) {
            this._accumulator += dt;
            if (this._accumulator < this._frameInterval) {
                this._rafId = requestAnimationFrame(this._tick);
                return;
            }
            // If we overshot, carry remainder forward
            this._accumulator %= this._frameInterval;
        }

        // ---- PRE stage ----
        this._runSubscribers(this._preSubs, dt, now);
        const preRead = this._preWriteA ? this._nextPreB : this._nextPreA; // read opposite buffer
        this._flushNextTasks(preRead, dt, now);
        this._preWriteA = !this._preWriteA;

        // ---- TICK (main) stage ----
        this._runSubscribers(this._tickSubs, dt, now);
        const tickRead = this._tickWriteA ? this._nextTickB : this._nextTickA;
        this._flushNextTasks(tickRead, dt, now);
        this._tickWriteA = !this._tickWriteA;

        // ---- POST stage ----
        this._runSubscribers(this._postSubs, dt, now);
        const postRead = this._postWriteA ? this._nextPostB : this._nextPostA;
        this._flushNextTasks(postRead, dt, now);
        this._postWriteA = !this._postWriteA;

        // Compact subscriber arrays occasionally to reclaim tombstones
        this._maybeCompact();

        // Schedule next frame
        this._rafId = requestAnimationFrame(this._tick);
    };

    // Periodically compact subscriber lists when too many tombstones accumulate.
    private _maybeCompact(): void {
        // thresholds: if 25%+ are dead and there are at least 32 items, compact
        if (this._preDead && this._preSubs.length >= 32 && this._preDead * 4 >= this._preSubs.length) { this._compact(this._preSubs); this._preDead = 0; }
        if (this._tickDead && this._tickSubs.length >= 32 && this._tickDead * 4 >= this._tickSubs.length) { this._compact(this._tickSubs); this._tickDead = 0; }
        if (this._postDead && this._postSubs.length >= 32 && this._postDead * 4 >= this._postSubs.length) { this._compact(this._postSubs); this._postDead = 0; }
    }

    private _compact(arr: (Subscriber | null)[]): void {
        let w = 0;
        for (let r = 0, n = arr.length; r < n; r++) {
            const v = arr[r];
            if (v !== null) arr[w++] = v;
        }
        arr.length = w; // truncate
    }
}

const emptyTask: NextTask = () => {};

// Polyfills for non-DOM environments (optional):
// If you're running under Node with a RAF polyfill, remove this section.
declare global {
    // eslint-disable-next-line no-var
    var requestAnimationFrame: (cb: (t: number) => void) => number;
    // eslint-disable-next-line no-var
    var cancelAnimationFrame: (id: number) => void;
}

if (typeof (globalThis as any).requestAnimationFrame === "undefined") {
    // Basic setTimeout-based shim (~60fps)
    let lastId = 0;
    const timers = new Map<number, any>();
    (globalThis as any).requestAnimationFrame = (cb: (t: number) => void) => {
        const id = ++lastId;
        const handle = setTimeout(() => cb(performance.now()), 16);
        timers.set(id, handle);
        return id;
    };
    (globalThis as any).cancelAnimationFrame = (id: number) => {
        const handle = timers.get(id);
        if (handle) clearTimeout(handle);
        timers.delete(id);
    };
}
