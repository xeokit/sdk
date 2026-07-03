import {DetailedRender, NavigationRender, RealisticRender} from "../../base/constants";
import type {View} from "../viewer";

// Default delay between the last camera change and the switch back to the
// rest render mode. Long enough that a flick of the mouse doesn't flicker
// into Detailed/Realistic mid-gesture, and short enough that the quality
// swap feels responsive when the user lets go.
const DEFAULT_REST_MS = 500;

// One AdaptiveQuality per View — a second instance on the same View would
// race the first on every camera event. Mirrors ViewCuller's liveCullers map.
const liveAdapters = new WeakMap<View, AdaptiveQuality>();

/**
 * Parameters for {@link AdaptiveQuality}.
 */
export interface AdaptiveQualityParams {
  /**
   * The {@link viewing!viewer.View | View} to drive.
   */
  view: View;

  /**
   * Render mode used while the camera is moving. Default
   * {@link base!constants.NavigationRender | NavigationRender}.
   *
   * Each effect (SAO, shadows, bloom, FXAA, ACES tonemap, edges, …) declares
   * its own `renderModes` list; an effect activates iff `view.renderMode` is
   * in that list. The Studio defaults exclude `NavigationRender` from every
   * expensive effect, so flipping the View into this mode automatically
   * disables them en masse.
   */
  fastMode?: number;

  /**
   * Render mode the view returns to once the camera settles. Default
   * {@link base!constants.RealisticRender | RealisticRender}.
   */
  restMode?: number;

  /**
   * Milliseconds the camera must be still before switching back to
   * `restMode`. Default 500 ms.
   */
  restMs?: number;
}

/**
 * Drives adaptive-quality switching for one {@link View}.
 *
 * Listens for camera changes on the View; on the first change in a burst it
 * flips `view.renderMode` to `fastMode` (default
 * {@link base!constants.NavigationRender | NavigationRender}), and once the
 * camera has been still for `restMs` it flips back to `restMode` (default
 * {@link base!constants.RealisticRender | RealisticRender}).
 *
 * The mode switch is the *only* mechanism — this component never touches
 * SAO, shadows, bloom, FXAA, tonemap, edges, IBL or section caps directly.
 * Each of those gates its own activation on `view.renderMode`, so flipping
 * the View's mode atomically toggles every effect whose `renderModes` list
 * doesn't include the new mode.
 *
 * At most one adapter may be live per View — constructing a second against
 * the same View throws. Call {@link AdaptiveQuality.destroy} first to
 * re-configure. The adapter also self-destroys when its View is destroyed,
 * so it never outlives it. On destroy the View is restored to `restMode`.
 *
 * @example
 * ```ts
 * import {AdaptiveQuality} from "@xeokit/sdk/viewing/adaptiveQuality";
 *
 * const aq = new AdaptiveQuality({view});
 * // …
 * aq.destroy();
 * ```
 */
export class AdaptiveQuality {

  /** The live adapter driving `view`, or `undefined` if none. */
  static getFor(view: View): AdaptiveQuality | undefined {
    return liveAdapters.get(view);
  }

  /** The View this adapter drives. */
  readonly view: View;

  readonly #fastMode: number;
  readonly #restMode: number;
  readonly #restMs: number;
  readonly #unsubscribers: (() => void)[] = [];

  #restTimer: ReturnType<typeof setTimeout> | null = null;
  #destroyed = false;

  constructor(params: AdaptiveQualityParams) {
    const {view} = params;
    if (liveAdapters.has(view)) {
      throw new Error(
        `[adaptiveQuality] View "${view.id}" already has an AdaptiveQuality — destroy it before creating another`
      );
    }
    this.view = view;
    this.#fastMode = params.fastMode ?? NavigationRender;
    this.#restMode = params.restMode ?? RealisticRender;
    this.#restMs = Math.max(0, params.restMs ?? DEFAULT_REST_MS);

    const events = view.viewer.events;
    const onCamera = (changedView: View) => {
      if (changedView === this.view) this.#onCameraChanged();
    };
    this.#unsubscribers.push(
      events.onCameraViewMatrixUpdated.subscribe((v) => onCamera(v)),
      events.onCameraProjMatrixUpdated.subscribe((v) => onCamera(v)),
      events.onCameraProjectionTypeChanged.subscribe((v) => onCamera(v)),
      // Self-destruct when the View is destroyed.
      events.onViewDestroyed.subscribe((_viewer, destroyedView) => {
        if (destroyedView === this.view) this.destroy();
      })
    );

    // Registered last, so a constructor that threw partway leaves no entry.
    liveAdapters.set(view, this);
  }

  /**
   * Stops the adapter, restores `restMode`, and releases subscriptions.
   */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    liveAdapters.delete(this.view);
    if (this.#restTimer !== null) {
      clearTimeout(this.#restTimer);
      this.#restTimer = null;
    }
    for (const unsubscribe of this.#unsubscribers) unsubscribe();
    this.#unsubscribers.length = 0;
    // Restore quality on the way out so a deliberate disable doesn't strand
    // the View in fastMode.
    if (this.view.renderMode !== this.#restMode) {
      this.view.renderMode = this.#restMode;
    }
  }

  #onCameraChanged(): void {
    if (this.#destroyed) return;
    if (this.view.renderMode !== this.#fastMode) {
      this.view.renderMode = this.#fastMode;
    }
    if (this.#restTimer !== null) clearTimeout(this.#restTimer);
    this.#restTimer = setTimeout(() => {
      this.#restTimer = null;
      if (this.#destroyed) return;
      if (this.view.renderMode !== this.#restMode) {
        this.view.renderMode = this.#restMode;
      }
    }, this.#restMs);
  }
}

// Re-exported for parity with NavigationRender — most users won't touch
// these but they're handy for params construction sites.
export {DetailedRender, NavigationRender, RealisticRender};
