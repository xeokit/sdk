import type {View} from "../viewer";
import type {ViewProfiles} from "../viewProfiles";

const DEFAULT_REST_MS = 500;
const DEFAULT_REST_IDLE_TIMEOUT_MS = 1000;
const DEFAULT_FAST_PROFILE = "fast";
const DEFAULT_REST_PROFILE = "realistic";

const liveAdapters = new WeakMap<ViewProfiles, AdaptiveQuality>();

/**
 * Parameters for {@link AdaptiveQuality}.
 */
export interface AdaptiveQualityParams {
  /**
   * The {@link viewing!viewProfiles.ViewProfiles | ViewProfiles}
   * component to drive.
   */
  viewProfiles: ViewProfiles;

  /**
   * Profile selected while the camera is moving. Default `"fast"`.
   */
  fastProfile?: string | null;

  /**
   * Profile selected once the camera settles. Default `"realistic"`.
   */
  restProfile?: string | null;

  /**
   * Milliseconds the camera must be still before switching back to
   * `restProfile`. Default 500 ms.
   */
  restMs?: number;

  /**
   * Maximum extra time to wait for an idle callback before restoring
   * `restProfile` after `restMs` has elapsed. Default 1000 ms.
   */
  restIdleTimeoutMs?: number;
}

/**
 * Drives adaptive-quality switching for one {@link ViewProfiles}.
 *
 * Listens for camera changes on the associated {@link View}. On the first
 * change in a burst it selects `fastProfile`; once the camera has been still
 * for `restMs`, it selects `restProfile`.
 *
 * At most one adapter may be live per ViewProfiles instance. Set
 * {@link AdaptiveQuality.enabled} to `false` to suspend adaptive switching
 * without releasing the adapter, or call {@link AdaptiveQuality.destroy} to
 * tear it down before re-configuring. On disable or destroy the component
 * restores `restProfile`.
 *
 * @example
 * ```ts
 * import {AdaptiveQuality} from "@xeokit/sdk/viewing/adaptiveQuality";
 *
 * const aq = new AdaptiveQuality({viewProfiles});
 * aq.destroy();
 * ```
 */
export class AdaptiveQuality {

  /** The live adapter driving `viewProfiles`, or `undefined` if none. */
  static getFor(viewProfiles: ViewProfiles): AdaptiveQuality | undefined {
    return liveAdapters.get(viewProfiles);
  }

  /** The ViewProfiles component this adapter drives. */
  readonly viewProfiles: ViewProfiles;

  /** The View owned by {@link AdaptiveQuality.viewProfiles}. */
  get view(): View {
    return this.viewProfiles.view;
  }

  readonly #fastProfile: string | null;
  readonly #restProfile: string | null;
  readonly #restMs: number;
  readonly #restIdleTimeoutMs: number;
  readonly #unsubscribers: (() => void)[] = [];

  #restTimer: ReturnType<typeof setTimeout> | null = null;
  #restIdleHandle: number | ReturnType<typeof setTimeout> | null = null;
  #restIdleHandleType: "idle" | "timeout" | null = null;
  #motionGeneration = 0;
  #enabled = true;
  #destroyed = false;

  constructor(params: AdaptiveQualityParams) {
    const {viewProfiles} = params;
    if (liveAdapters.has(viewProfiles)) {
      throw new Error(
        `[adaptiveQuality] ViewProfiles for View "${viewProfiles.view.id}" already has an AdaptiveQuality - destroy it before creating another`
      );
    }
    this.viewProfiles = viewProfiles;
    this.#fastProfile = params.fastProfile ?? DEFAULT_FAST_PROFILE;
    this.#restProfile = params.restProfile ?? DEFAULT_REST_PROFILE;
    this.#restMs = Math.max(0, params.restMs ?? DEFAULT_REST_MS);
    this.#restIdleTimeoutMs = Math.max(0, params.restIdleTimeoutMs ?? DEFAULT_REST_IDLE_TIMEOUT_MS);

    const view = viewProfiles.view;
    const events = view.viewer.events;
    const onCamera = (changedView: View) => {
      if (changedView === this.view) this.#onCameraChanged();
    };
    this.#unsubscribers.push(
      events.onCameraViewMatrixUpdated.subscribe((v) => onCamera(v)),
      events.onCameraProjMatrixUpdated.subscribe((v) => onCamera(v)),
      events.onCameraProjectionTypeChanged.subscribe((v) => onCamera(v)),
      events.onViewDestroyed.subscribe((_viewer, destroyedView) => {
        if (destroyedView === this.view) this.destroy();
      })
    );

    liveAdapters.set(viewProfiles, this);
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  set enabled(value: boolean) {
    const enabled = value !== false;
    if (this.#destroyed || this.#enabled === enabled) return;
    this.#enabled = enabled;
    if (!enabled) {
      this.#restoreRestProfile();
    }
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    liveAdapters.delete(this.viewProfiles);
    this.#restoreRestProfile();
    for (const unsubscribe of this.#unsubscribers) unsubscribe();
    this.#unsubscribers.length = 0;
  }

  #setProfile(id: string | null): void {
    if (this.viewProfiles.activeProfile === id) return;
    this.viewProfiles.setActiveProfile(id);
  }

  #restoreRestProfile(): void {
    this.#clearPendingRestRestore();
    this.#setProfile(this.#restProfile);
  }

  #clearPendingRestRestore(): void {
    if (this.#restTimer !== null) {
      clearTimeout(this.#restTimer);
      this.#restTimer = null;
    }
    if (this.#restIdleHandle !== null) {
      if (this.#restIdleHandleType === "idle") {
        const cancelIdleCallback = (globalThis as any).cancelIdleCallback;
        if (typeof cancelIdleCallback === "function") {
          cancelIdleCallback(this.#restIdleHandle);
        }
      } else {
        clearTimeout(this.#restIdleHandle as ReturnType<typeof setTimeout>);
      }
      this.#restIdleHandle = null;
      this.#restIdleHandleType = null;
    }
  }

  #onCameraChanged(): void {
    if (this.#destroyed || !this.#enabled) return;
    this.#motionGeneration++;
    this.#clearPendingRestRestore();
    this.#setProfile(this.#fastProfile);
    const generation = this.#motionGeneration;
    this.#restTimer = setTimeout(() => {
      this.#restTimer = null;
      this.#scheduleRestProfileRestore(generation);
    }, this.#restMs);
  }

  #scheduleRestProfileRestore(generation: number): void {
    const restore = () => {
      this.#restIdleHandle = null;
      this.#restIdleHandleType = null;
      if (this.#destroyed || !this.#enabled || generation !== this.#motionGeneration) return;
      this.#setProfile(this.#restProfile);
    };
    const requestIdleCallback = (globalThis as any).requestIdleCallback;
    if (typeof requestIdleCallback === "function") {
      this.#restIdleHandleType = "idle";
      this.#restIdleHandle = requestIdleCallback(restore, {timeout: this.#restIdleTimeoutMs});
      return;
    }
    this.#restIdleHandleType = "timeout";
    this.#restIdleHandle = setTimeout(restore, 0);
  }
}
