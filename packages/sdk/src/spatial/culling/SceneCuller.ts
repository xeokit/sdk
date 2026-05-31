import {getSceneCollisionIndex} from "../collision";
import type {Scene, SceneObject} from "../../model/scene";
import {CullBoundsMirror} from "./CullBoundsMirror";
import {createCullingWorker, type CullingWorkerHandle} from "./createCullingWorker";
import type {CullingOutputMessage, ViewChangedMessage} from "./CullingProtocol";

/**
 * Receives a worker message addressed to a view — either a `CullResults` delta
 * (dense mirror indices; resolve with {@link SceneCuller.objectIdAt}) or a
 * `Done` (no change this pass). Both are forwarded so the caller can track when
 * the worker has caught up.
 */
export type CullingResultListener = (message: CullingOutputMessage) => void;

/**
 * Owns the culling worker and the bounds mirror for one {@link Scene}.
 *
 * There is one service per Scene (see {@link getSceneCuller}), shared by
 * every {@link ViewCuller}: the bounds mirror — potentially millions of
 * spheres — is held once, while the worker keeps cull state separately per
 * view. The service keeps the mirror in step with the Scene by subscribing to
 * the same mutation events the {@link SceneCollisionIndex} uses, and reads
 * bounds back from that index on flush.
 */
export class SceneCuller {

  /** The Scene this service culls. */
  readonly scene: Scene;

  readonly #mirror: CullBoundsMirror;
  readonly #worker: CullingWorkerHandle;
  readonly #listeners = new Map<string, CullingResultListener>();
  readonly #unsubscribers: (() => void)[] = [];
  #flushScheduled = false;
  #destroyed = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.#mirror = new CullBoundsMirror(getSceneCollisionIndex(scene));
    this.#worker = createCullingWorker();
    this.#worker.onMessage((message) => {
      this.#listeners.get(message.viewId)?.(message);
    });

    // Seed with the objects already in the Scene.
    for (const id in scene.objects) {
      this.#addObject(scene.objects[id]);
    }

    const events = scene.events;
    this.#unsubscribers.push(
      events.onSceneObjectCreated.subscribe((_scene, object) => this.#addObject(object)),
      events.onSceneObjectDestroyed.subscribe((_scene, object) => {
        this.#mirror.remove(object.id);
        this.#scheduleFlush();
      }),
      events.onSceneObjectMeshAdded.subscribe((object) => {
        this.#mirror.touch(object.id);
        this.#scheduleFlush();
      }),
      events.onSceneMeshMoved.subscribe((_scene, mesh) => this.#touchMeshOwner(mesh)),
      events.onSceneMeshMatrixChanged.subscribe((_scene, mesh) => this.#touchMeshOwner(mesh))
    );
  }

  /**
   * Registers a view's cull-results listener. Call {@link postViewChanged} to
   * drive culling for it.
   */
  registerView(viewId: string, listener: CullingResultListener): void {
    this.#listeners.set(viewId, listener);
  }

  /**
   * Forgets a view and discards its cull state in the worker.
   */
  unregisterView(viewId: string): void {
    if (this.#listeners.delete(viewId) && !this.#destroyed) {
      this.#worker.post({type: "RemoveView", viewId});
    }
  }

  /**
   * Posts a fresh camera for a view, triggering a cull pass. Any pending bounds
   * changes are flushed first so the pass sees current geometry.
   */
  postViewChanged(message: ViewChangedMessage): void {
    if (this.#destroyed) {
      return;
    }
    this.#flushNow();
    this.#worker.post(message);
  }

  /**
   * Resolves a dense mirror index back to its {@link SceneObject.id}.
   */
  objectIdAt(index: number): string | undefined {
    return this.#mirror.objectIdAt(index);
  }

  /**
   * Tears down the worker and unsubscribes from the Scene.
   */
  destroy(): void {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    for (const unsubscribe of this.#unsubscribers) {
      unsubscribe();
    }
    this.#unsubscribers.length = 0;
    this.#listeners.clear();
    this.#worker.terminate();
  }

  #addObject(object: SceneObject): void {
    this.#mirror.put(object.id, isCullable(object));
    this.#scheduleFlush();
  }

  #touchMeshOwner(mesh: {object: SceneObject | null}): void {
    if (mesh.object) {
      this.#mirror.touch(mesh.object.id);
      this.#scheduleFlush();
    }
  }

  // Coalesce a burst of Scene mutations into a single flush on the next
  // microtask, after the synchronous event dispatch settles (so the collision
  // index has the up-to-date AABBs when we read them).
  #scheduleFlush(): void {
    if (this.#flushScheduled || this.#destroyed) {
      return;
    }
    this.#flushScheduled = true;
    queueMicrotask(() => {
      this.#flushScheduled = false;
      this.#flushNow();
    });
  }

  #flushNow(): void {
    if (this.#destroyed) {
      return;
    }
    const message = this.#mirror.marshal();
    if (message) {
      this.#worker.post(message);
    }
  }
}

/**
 * Whether an object may be size-culled.
 *
 * Returns `true` for all objects today: ordinary surface/line/point geometry
 * has real world extent and culls correctly. The one case this would get wrong
 * is geometry pinned to a fixed on-screen size (a screen-space gizmo, billboard
 * label, and the like) — its tiny world bounds fall below the solid-angle limit
 * and cull the instant it's not close. xeokit has no such flag today, so this
 * returns `true` for now. The whole pipeline already carries a per-object
 * cullable flag, so a future SceneObject hint can refine this in one place.
 */
function isCullable(_object: SceneObject): boolean {
  return true;
}

// One service per Scene, lazily created and torn down with the Scene.
const services: Record<string, SceneCuller | undefined> = {};

/**
 * Gets or lazily creates the {@link SceneCuller} for a Scene, mirroring the
 * lifecycle of {@link getSceneCollisionIndex}.
 */
export function getSceneCuller(scene: Scene): SceneCuller {
  let service = services[scene.id];
  if (!service) {
    service = services[scene.id] = new SceneCuller(scene);
    scene.events.onSceneDestroyed.subscribe((destroyedScene) => {
      services[destroyedScene.id]?.destroy();
      delete services[destroyedScene.id];
    });
  }
  return service;
}
