import type {PickParams} from "./PickParams";
import type {PickResult} from "./PickResult";

/**
 * Abstract picking backend.
 *
 * Implementations:
 *
 *   - {@link BVHPickStrategy} — CPU ray pick via the {@link "../collision".SceneRaycaster}.
 *     No snap support; snap requests degrade silently.
 *   - {@link RendererPickStrategy} — GPU pick via the
 *     {@link "../webGLRenderer".WebGLRenderer}. Full snap support.
 *   - {@link RoutingPickStrategy} — composes the two leaves; routes
 *     each call to whichever backend can answer it. The default
 *     choice for general-purpose picking.
 *
 * A future {@link MemoisingPickStrategy} (decorator) is anticipated in
 * the same module — the interface stays minimal so decorators compose
 * naturally.
 *
 * ### Lifetime
 *
 * Strategies that subscribe to events (renderer attach, context loss)
 * implement {@link dispose} to unwind those subscriptions. Pure
 * adapters can leave it unimplemented.
 */
export interface PickStrategy {

  /**
   * Run one pick. Sync — even when the GPU backend is involved,
   * `gl.readPixels` blocks until the result is in. See
   * {@link PickResult} for what's populated.
   */
  pick(params: PickParams): PickResult;

  /**
   * Monotonic counter that bumps every time the strategy's internal
   * state changes in a way that invalidates cached results — for
   * example, when a {@link RoutingPickStrategy}'s renderer becomes
   * available, or its WebGL context is lost. A future memoising
   * decorator compares this against the epoch stamped on cached
   * results to know when to drop them.
   *
   * Strategies whose state never changes (e.g. {@link BVHPickStrategy})
   * may always return `0`.
   */
  readonly stateEpoch: number;

  /**
   * Tear down any held subscriptions or cached resources. Idempotent.
   * Optional — most leaves don't need it.
   */
  dispose?(): void;
}
