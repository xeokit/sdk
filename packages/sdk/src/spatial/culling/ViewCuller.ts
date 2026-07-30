import {Frustum3, setFrustum3} from "../../base/math/boundaries";
import type {View} from "../../viewing/viewer";
import {DEFAULT_CULL_PARAMS, type CullParams} from "./CullParams";
import {getSceneCuller, type SceneCuller} from "./SceneCuller";
import type {CullingOutputMessage, CullResultsMessage} from "./CullingProtocol";

// Delay after the last camera change before a final "settled" pass runs, so the
// resting frame matches the camera's final position. There is no
// "movement-finished" camera event, so a trailing timeout is used instead.
const TRAILING_MS = 100;

// At most one live ViewCuller per View. A second culler on the same View would
// overwrite the first's worker listener in SceneCuller and silently break it,
// so construction rejects the duplicate. Keyed by the View object; entries
// clear on destroy (and when the View is garbage-collected).
const liveCullers = new WeakMap<View, ViewCuller>();

/**
 * Drives frustum and solid-angle culling for one {@link View}, off the main
 * thread.
 *
 * Each camera change rebuilds the view's frustum and posts it to the shared
 * {@link SceneCuller} worker; the returned cull deltas are applied via
 * {@link View.setObjectsCulled}. Posting is throttled to every Nth camera
 * change, plus a trailing pass once motion settles, with at most one pass in
 * flight at a time.
 *
 * Construct one against a {@link View} to start culling it; call
 * {@link ViewCuller.destroy} to stop and un-cull every object. The culler also
 * self-destroys when its View is destroyed, so it never outlives it.
 *
 * At most one culler may be live per View — constructing a second against the
 * same View throws. Destroy the existing one first to re-create with different
 * {@link CullParams}.
 */
export class ViewCuller {

  /** The View this culler drives. */
  readonly view: View;

  readonly #service: SceneCuller;
  readonly #solidAngleLimit: number;
  readonly #cullEveryNUpdates: number;
  readonly #frustum = new Frustum3();
  readonly #unsubscribers: (() => void)[] = [];

  #tick = 0;
  #workerReady = true;
  #pending = false;
  #trailingTimer: ReturnType<typeof setTimeout> | null = null;
  #destroyed = false;

  constructor(view: View, params?: CullParams) {
    if (liveCullers.has(view)) {
      throw new Error(
        `[culling] View "${view.id}" already has a ViewCuller — destroy it before creating another`
      );
    }
    this.view = view;
    const resolved = <any>{...DEFAULT_CULL_PARAMS, ...params};
    this.#solidAngleLimit = resolved.solidAngleLimit;
    this.#cullEveryNUpdates = Math.max(1, resolved.cullEveryNUpdates);

    this.#service = getSceneCuller(view.viewer.scene);
    this.#service.registerView(view.id, (message) => this.#onWorkerMessage(message));

    const events = view.viewer.events;
    const onCamera = (changedView: View) => {
      if (changedView === this.view) {
        this.#onCameraChanged();
      }
    };
    this.#unsubscribers.push(
      events.onCameraViewMatrixUpdated.subscribe((v) => onCamera(v)),
      events.onCameraProjMatrixUpdated.subscribe((v) => onCamera(v)),
      events.onCameraProjectionTypeChanged.subscribe((v) => onCamera(v)),
      // Self-destruct when the View is destroyed: the View has no knowledge of
      // culling, so the culler is responsible for not outliving it.
      events.onViewDestroyed.subscribe((_viewer, destroyedView) => {
        if (destroyedView === this.view) {
          this.destroy();
        }
      })
    );

    // Initial pass for the current camera.
    this.#cullNow();

    // Registered last, so a constructor that threw partway leaves no entry and
    // a retry is allowed.
    liveCullers.set(view, this);
  }

  /**
   * Stops culling, releases all subscriptions, and un-culls every object in the
   * view so disabling culling restores full visibility.
   */
  destroy(): void {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    liveCullers.delete(this.view);
    if (this.#trailingTimer !== null) {
      clearTimeout(this.#trailingTimer);
    }
    for (const unsubscribe of this.#unsubscribers) {
      unsubscribe();
    }
    this.#unsubscribers.length = 0;
    this.#service.unregisterView(this.view.id);

    const allIds = Object.keys(this.view.objects);
    if (allIds.length > 0 && this.view.setObjectsCulled(allIds, false)) {
      this.view.needsRender();
    }
  }

  /**
   * Runs a cull pass for the View's current camera immediately.
   *
   * The culler already runs on camera changes. Call this after a burst of
   * SceneObject creation, such as streaming in new chunks, when newly resident
   * objects should be classified before the camera moves again.
   */
  cullNow(): void {
    this.#cullNow();
  }

  #onCameraChanged(): void {
    if (this.#destroyed) {
      return;
    }
    if (this.#tick % this.#cullEveryNUpdates === 0) {
      this.#cullNow();
    }
    this.#tick++;
    // (Re)arm the trailing pass so the final resting frame is always culled.
    if (this.#trailingTimer !== null) {
      clearTimeout(this.#trailingTimer);
    }
    this.#trailingTimer = setTimeout(() => {
      this.#trailingTimer = null;
      this.#cullNow();
    }, TRAILING_MS);
  }

  #cullNow(): void {
    if (this.#destroyed) {
      return;
    }
    // Single in-flight pass: if the worker hasn't answered the last camera yet,
    // remember to re-cull with the latest camera once it does.
    if (!this.#workerReady) {
      this.#pending = true;
      return;
    }

    const camera = this.view.camera;
    setFrustum3(camera.viewMatrix, camera.projMatrix, this.#frustum);

    const planes = new Float64Array(24);
    for (let i = 0; i < 6; i++) {
      const plane = this.#frustum.planes[i];
      const o = i * 4;
      planes[o] = plane.normal[0];
      planes[o + 1] = plane.normal[1];
      planes[o + 2] = plane.normal[2];
      planes[o + 3] = plane.offset;
    }

    const eye = camera.eye;
    this.#workerReady = false;
    this.#service.postViewChanged({
      type: "ViewChanged",
      viewId: this.view.id,
      planes,
      eye: new Float64Array([eye[0], eye[1], eye[2]]),
      solidAngleLimit: this.#solidAngleLimit
    });
  }

  #onWorkerMessage(message: CullingOutputMessage): void {
    this.#workerReady = true;
    if (message.type === "CullResults") {
      this.#applyResults(message);
    }
    // The latest camera arrived while a pass was in flight — run it now.
    if (this.#pending && !this.#destroyed) {
      this.#pending = false;
      this.#cullNow();
    }
  }

  #applyResults(message: CullResultsMessage): void {
    if (this.#destroyed) {
      return;
    }
    const toCull: string[] = [];
    const toShow: string[] = [];
    for (const index of message.newlyCulled) {
      const id = this.#service.objectIdAt(index);
      if (id !== undefined) {
        toCull.push(id);
      }
    }
    for (const index of message.newlyUnCulled) {
      const id = this.#service.objectIdAt(index);
      if (id !== undefined) {
        toShow.push(id);
      }
    }

    let changed = false;
    if (toCull.length > 0) {
      changed = this.view.setObjectsCulled(toCull, true) || changed;
    }
    if (toShow.length > 0) {
      changed = this.view.setObjectsCulled(toShow, false) || changed;
    }
    if (changed) {
      this.view.needsRender();
    }
  }
}
