import type {PickParams} from "./PickParams";
import type {PickResult} from "./PickResult";
import type {PickStrategy} from "./PickStrategy";

/**
 * Construction options for {@link MemoisingPickStrategy}.
 */
export interface MemoisingPickStrategyOptions {
  /**
   * Pixel tolerance for `canvasPos` changes — the cache hits when
   * the cursor moved at most this many pixels along *either* axis
   * since the last call. `0` ⇒ exact match.
   *
   * Default `0`. Larger values amortise GPU pick stalls when the
   * cursor jitters around a still position, but risk returning a
   * stale snap when a closer vertex / edge has come into range at
   * the new position. `2` is usually the most you'd want; higher
   * starts to feel laggy on snap-aware hover UX.
   */
  canvasPosTolerance?: number;
}

/**
 * Decorator strategy that memoises the most recent {@link PickResult}
 * from an inner {@link PickStrategy}.
 *
 * Single-entry cache, sized 1 — the value here is amortising the
 * common stillness case (cursor parked on a vertex while the user
 * decides where to click; multiple unrelated callers picking the
 * same canvas point in the same frame). For multi-entry LRU or
 * cross-frame batching we'd compose another decorator on top.
 *
 * ### Invalidation
 *
 * The cache key includes the inner strategy's {@link PickStrategy.stateEpoch}.
 * When that bumps — e.g. {@link RoutingPickStrategy} sees the
 * renderer attach or the WebGL context get lost — every prior
 * cached result silently becomes a miss on the next call. No
 * explicit subscription needed.
 *
 * ### Skipped paths
 *
 *   - **filter callback supplied** — function identity isn't stable
 *     enough to cache safely.
 *   - **ray / matrix input** — uncommon on the hover hot path; the
 *     cache key would need a richer hash and we'd be amortising
 *     against ourselves.
 *
 * Both bypass the cache and call the inner strategy directly. The
 * `skipped` counter on {@link stats} surfaces how often that
 * happens.
 *
 * ### Result identity
 *
 * Cache hits return the cached {@link PickResult} *by reference*.
 * The {@link PickResult} contract is "plain immutable struct" — if
 * a caller mutates a returned result, subsequent cache hits will
 * see the mutation. Don't.
 */
export class MemoisingPickStrategy implements PickStrategy {

  private readonly _inner: PickStrategy;
  private readonly _tolerance: number;

  private _cacheKey:    CacheKey | null = null;
  private _cacheResult: PickResult | null = null;

  /**
   * Diagnostic counters. Mutable, read-only by convention. Reset
   * on {@link clearCache}.
   */
  readonly stats = { hits: 0, misses: 0, skipped: 0 };

  constructor(inner: PickStrategy, options: MemoisingPickStrategyOptions = {}) {
    this._inner = inner;
    this._tolerance = Math.max(0, options.canvasPosTolerance ?? 0);
  }

  /** Pass-through — the memoiser has no state of its own that
   *  invalidates results, so callers should react to *inner* state
   *  changes. */
  get stateEpoch(): number { return this._inner.stateEpoch; }

  pick(params: PickParams): PickResult {

    // Bypass for params we can't (or don't want to) hash safely.
    if (params.filter || params.ray || params.matrix) {
      this.stats.skipped++;
      return this._inner.pick(params);
    }

    const epoch = this._inner.stateEpoch;
    const key   = makeKey(params, epoch);

    if (this._cacheKey && keyEquals(this._cacheKey, key, this._tolerance)) {
      this.stats.hits++;
      return this._cacheResult!;
    }

    this.stats.misses++;
    const result = this._inner.pick(params);
    this._cacheKey = key;
    this._cacheResult = result;
    return result;
  }

  /**
   * Drop the cached entry and reset {@link stats}. The cache also
   * self-invalidates on inner-strategy state changes via the epoch
   * mechanism — call this only when an *external* event (e.g. a
   * known-stale Scene mutation) needs to force a re-pick.
   */
  clearCache(): void {
    this._cacheKey = null;
    this._cacheResult = null;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.skipped = 0;
  }

  dispose(): void {
    this.clearCache();
    this._inner.dispose?.();
  }
}

// ── Cache key ────────────────────────────────────────────────────────

/**
 * Captures every input that affects the {@link PickResult}, so an
 * equal key is a sufficient condition for a cache hit. View is
 * compared by reference (stable per session); other fields by value.
 */
interface CacheKey {
  view:    object;
  canvasX: number;
  canvasY: number;
  hasCanvasPos: boolean;
  snapV:   boolean;
  snapE:   boolean;
  snapR:   number;
  pickInv: boolean;
  pickN:   boolean;
  tMin:    number;
  tMax:    number;
  epoch:   number;
}

function makeKey(params: PickParams, epoch: number): CacheKey {
  const hasCanvas = !!params.canvasPos;
  return {
    view:         params.view as unknown as object,
    canvasX:      hasCanvas ? params.canvasPos![0] : 0,
    canvasY:      hasCanvas ? params.canvasPos![1] : 0,
    hasCanvasPos: hasCanvas,
    snapV:        params.snapToVertex === true,
    snapE:        params.snapToEdge   === true,
    snapR:        params.snapRadius ?? 30,
    pickInv:      params.pickInvisible === true,
    pickN:        params.pickSurfaceNormal === true,
    tMin:         params.tMin ?? 0,
    tMax:         params.tMax ?? Infinity,
    epoch,
  };
}

/**
 * Compare two keys, accepting `tolerance` pixels of canvas drift.
 * All other fields must match exactly.
 */
function keyEquals(a: CacheKey, b: CacheKey, tolerance: number): boolean {
  if (a.view !== b.view) return false;
  if (a.hasCanvasPos !== b.hasCanvasPos) return false;
  if (a.snapV   !== b.snapV)   return false;
  if (a.snapE   !== b.snapE)   return false;
  if (a.snapR   !== b.snapR)   return false;
  if (a.pickInv !== b.pickInv) return false;
  if (a.pickN   !== b.pickN)   return false;
  if (a.tMin    !== b.tMin)    return false;
  if (a.tMax    !== b.tMax)    return false;
  if (a.epoch   !== b.epoch)   return false;

  if (a.hasCanvasPos) {
    if (Math.abs(a.canvasX - b.canvasX) > tolerance) return false;
    if (Math.abs(a.canvasY - b.canvasY) > tolerance) return false;
  }
  return true;
}
