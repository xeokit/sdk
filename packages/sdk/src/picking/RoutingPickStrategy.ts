import type {Scene} from "../scene";
import type {WebGLRenderer} from "../webGLRenderer";
import {BVHPickStrategy} from "./BVHPickStrategy";
import type {PickParams} from "./PickParams";
import type {PickResult} from "./PickResult";
import type {PickStrategy} from "./PickStrategy";
import {RendererPickStrategy} from "./RendererPickStrategy";

/**
 * The default {@link PickStrategy} for general-purpose use — composes a
 * {@link BVHPickStrategy} and (optionally) a {@link RendererPickStrategy}
 * and routes each call to whichever backend can answer it.
 *
 * ### Routing rule
 *
 * | Request                                                  | Backend |
 * | -------------------------------------------------------- | ------- |
 * | snap-to-vertex / snap-to-edge requested AND GPU is ready | GPU     |
 * | filter callback supplied                                 | BVH     |
 * | ray / matrix input                                       | BVH     |
 * | otherwise                                                | BVH     |
 *
 * GPU unavailable (no renderer attached, context lost, renderer not
 * yet started) ⇒ snap requests fall through silently to BVH and the
 * result's {@link PickResult.snap} stays `null`. The caller's
 * {@link PickResult.strategyUsed} tells them what actually ran.
 *
 * ### Renderer observability
 *
 * Constructor accepts a renderer that is *not yet attached*. The
 * strategy subscribes to renderer lifecycle / context-loss events and
 * flips an internal `gpuReady` flag as those transitions happen.
 * Each transition bumps {@link stateEpoch} so memoising decorators can
 * invalidate cached results that became stale across a state change
 * (a result computed via BVH while the renderer was unavailable should
 * not be served once GPU snap becomes available, for example).
 *
 * ### Lifecycle
 *
 * {@link dispose} unwinds all subscriptions. Idempotent.
 */
export class RoutingPickStrategy implements PickStrategy {

  private readonly _bvh: BVHPickStrategy;
  private readonly _gpu: RendererPickStrategy | null;
  private readonly _renderer: WebGLRenderer | null;

  /** Live unsubscribers from renderer event subscriptions. */
  private readonly _unsubs: Array<() => void> = [];

  /**
   * Whether the GPU backend is ready to serve picks right now.
   * Recomputed on every renderer-state transition; checked per
   * pick. False also when no renderer was supplied.
   */
  private _gpuReady: boolean;

  /**
   * Bumped on every state transition that could invalidate cached
   * results. Currently: GPU readiness flips + WebGL context loss.
   */
  private _stateEpoch = 0;
  private _disposed = false;

  /**
   * @param scene Scene whose BVH the BVH leaf queries.
   * @param renderer Optional renderer for the GPU leaf. May be passed
   *   in pre-attach — the strategy waits for `onViewerAttached` /
   *   `onRendererStarted` to flip its internal readiness flag. When
   *   omitted, the strategy is BVH-only forever (snap requests
   *   silently degrade).
   */
  constructor(scene: Scene, renderer?: WebGLRenderer) {
    this._bvh      = new BVHPickStrategy(scene);
    this._renderer = renderer ?? null;
    this._gpu      = renderer ? new RendererPickStrategy(renderer) : null;

    // Initial readiness — `rendering` is true only after a viewer
    // with a Scene is attached AND the renderer initialised. So a
    // renderer passed in pre-attach starts out !ready, then flips
    // when the attach event fires.
    this._gpuReady = !!renderer && renderer.rendering;

    if (renderer) this._wireRenderer(renderer);
  }

  get stateEpoch(): number { return this._stateEpoch; }

  /** True when GPU snap is currently available. Reads the live flag. */
  get gpuReady(): boolean { return this._gpuReady; }

  pick(params: PickParams): PickResult {
    if (this._disposed) {
      // Strategy is gone — degrade to a BVH-shaped miss rather than
      // throw. Mostly defensive; callers shouldn't be picking after
      // dispose.
      return this._bvh.pick(params);
    }

    const wantSnap   = !!(params.snapToVertex || params.snapToEdge);
    const hasFilter  = !!params.filter;
    const isRayPick  = !!(params.ray || params.matrix);

    // GPU branch eligibility — the routing rule, condensed.
    const useGpu =
      this._gpuReady &&        // GPU available
      this._gpu &&             // renderer was supplied
      wantSnap &&              // only reason to choose GPU today
      !hasFilter &&            // GPU has no filter callback
      !isRayPick;              // GPU snap is canvas-only

    const result = useGpu
      ? this._gpu!.pick(params)
      : this._bvh.pick(params);

    // The leaves stamp `_stateEpoch: 0`; overwrite with our own so
    // memoising decorators see strategy-level state changes (renderer
    // attach, context loss) reflected on the result. Mutating here is
    // safe — the leaves construct a fresh result per call.
    result._stateEpoch = this._stateEpoch;
    return result;
  }

  /** Tear down renderer event subscriptions. Idempotent. */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    for (const unsub of this._unsubs) {
      try { unsub(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
  }

  // ── Internals ────────────────────────────────────────────────────

  /**
   * Subscribe to the renderer events that matter for `gpuReady`. We
   * read `renderer.rendering` on every transition rather than
   * tracking the events' implications individually — keeps the state
   * machine trivially correct as the renderer's event surface
   * evolves.
   */
  private _wireRenderer(renderer: WebGLRenderer): void {
    const events = renderer.events;
    const handle = () => this._refreshGpuReady();

    // Event names match `WebGLRenderer.events` (see
    // packages/sdk/src/webGLRenderer/WebGLRenderer.ts).
    this._unsubs.push(events.onViewerAttached.subscribe(handle));
    this._unsubs.push(events.onViewerDetached.subscribe(handle));
    this._unsubs.push(events.onRendererStarted.subscribe(handle));
    this._unsubs.push(events.onRendererStopped.subscribe(handle));
    this._unsubs.push(events.onRendererDestroyed.subscribe(handle));
    this._unsubs.push(events.webglContextLost.subscribe(handle));
    this._unsubs.push(events.webglContextRestored.subscribe(handle));
  }

  private _refreshGpuReady(): void {
    if (this._disposed) return;
    const next = !!this._renderer && this._renderer.rendering;
    if (next === this._gpuReady) return;
    this._gpuReady = next;
    this._stateEpoch++;
  }

}
