import {sortSplatsByDepth} from "./sortSplats";

/**
 * Off-main-thread back-to-front splat depth sort.
 *
 * Wraps an inline Blob web worker whose body is {@link sortSplatsByDepth},
 * shipped via `Function.prototype.toString()` — so there's no separate worker
 * file or extra build step, and the sort algorithm stays single-sourced (and
 * unit-tested). Stateful: feed centres once per batch change ({@link setPositions}),
 * then {@link requestSort} on each camera move; read the double-buffered result
 * from {@link latest}.
 *
 * If `Worker` is unavailable (non-browser / blocked), it degrades to a no-op —
 * `latest` stays null and the technique falls back to unsorted draw order.
 */
function buildWorkerSource(): string {
  // sortSplatsByDepth is self-contained, so its stringified source runs as-is
  // inside the worker (even after esbuild minification).
  return `
const sortFn = ${sortSplatsByDepth.toString()};
let positions = null, itemIndices = null;
self.onmessage = function (e) {
  const d = e.data;
  if (d.t === 0) { positions = d.positions; itemIndices = d.itemIndices; return; }
  if (d.t === 1) {
    if (!positions || itemIndices.length === 0) { return; }
    const sorted = sortFn(positions, itemIndices, d.view);
    self.postMessage({ sorted: sorted, rev: d.rev }, [sorted.buffer]);
  }
};`;
}

export class SplatSortWorker {

  private _worker: Worker | null = null;
  private _latest: Uint32Array | null = null;
  private _busy = false;
  private _pendingView: Float32Array | null = null;
  private _rev = 0;          // positions revision; results for stale revs are dropped
  private _latestRev = -1;

  constructor() {
    try {
      const src = buildWorkerSource();
      const url = URL.createObjectURL(new Blob([src], {type: "text/javascript"}));
      this._worker = new Worker(url);
      URL.revokeObjectURL(url);
      this._worker.onmessage = (e: MessageEvent) => {
        this._busy = false;
        if (e.data.rev === this._rev) {
          this._latest = e.data.sorted as Uint32Array;
          this._latestRev = e.data.rev;
        }
        // A camera move arrived mid-sort — kick the next one now.
        if (this._pendingView) {
          const v = this._pendingView;
          this._pendingView = null;
          this._dispatch(v);
        }
      };
    } catch {
      this._worker = null; // graceful no-op fallback (unsorted draw)
    }
  }

  /** Feed the splat centres (compact) + their texture item-indices. Invalidates latest. */
  setPositions(positions: Float32Array, itemIndices: Uint32Array): void {
    if (!this._worker) return;
    this._rev++;
    this._latest = null;
    this._latestRev = -1;
    const p = positions.slice();      // copies so we can transfer (caller keeps its arrays)
    const idx = itemIndices.slice();
    this._worker.postMessage({t: 0, positions: p, itemIndices: idx}, [p.buffer, idx.buffer]);
  }

  /** Request a sort for `view`. Coalesces to the newest view while one is in flight. */
  requestSort(view: Float32Array): void {
    if (!this._worker) return;
    if (this._busy) {
      this._pendingView = view.slice() as Float32Array;
      return;
    }
    this._dispatch(view);
  }

  private _dispatch(view: Float32Array): void {
    const v = view.slice() as Float32Array;
    this._busy = true;
    this._worker!.postMessage({t: 1, view: v, rev: this._rev}, [v.buffer]);
  }

  /** Most recent sorted texture item-indices, or null if none computed yet. */
  get latest(): Uint32Array | null {
    return this._latest;
  }

  /** Whether {@link latest} reflects the current positions revision. */
  get latestIsCurrent(): boolean {
    return this._latestRev === this._rev;
  }

  destroy(): void {
    this._worker?.terminate();
    this._worker = null;
    this._latest = null;
  }
}
