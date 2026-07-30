/**
 * # xeokit View Culling
 *
 * ---
 *
 * **Off-thread frustum and solid-angle culling for a
 * {@link viewing!viewer.View | View}. A bounding sphere per object is mirrored
 * into a Web Worker, which flips {@link viewing!viewer.ViewObject.culled} as the
 * camera moves so the renderer skips what's off-screen or too small to see.**
 *
 * ---
 *
 * The `culling` module trims a {@link viewing!viewer.View | View}'s draw load
 * without blocking the main thread. One bounding sphere per
 * {@link model!scene.SceneObject | SceneObject} is mirrored into a worker; each
 * camera change posts the view's frustum, and the worker returns only the
 * objects whose state flipped since the last pass. Those deltas are written to
 * {@link viewing!viewer.ViewObject.culled | ViewObject.culled}, and the renderer
 * drops their meshes from the view's draw index.
 *
 * One worker and one bounds mirror serve a whole {@link model!scene.Scene | Scene},
 * retrieved via {@link getSceneCuller}. The mirror — one sphere per object — is
 * held once and shared by every {@link viewing!viewer.View | View}, while cull
 * state is tracked per view, so each camera culls independently.
 *
 * The worker scans a **flat list of spheres** — `O(n)` per camera, with no
 * spatial hierarchy. Bounds come from the collision index and stay current
 * through the same scene-mutation events, but that index's BVH is never
 * traversed: it lives on the main thread, beyond the worker's reach. The trade
 * is deliberate — hierarchical `O(log n)` acceleration is given up so the scan
 * never blocks the render loop. For BVH-accelerated frustum culling on the main
 * thread instead, use `SceneCollisionIndex.intersectFrustum()`.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class View {
 *       <<viewer>>
 *     }
 *     class ViewCuller {
 *       +view : View
 *       +cullNow()
 *       +destroy()
 *     }
 *     class getSceneCuller {
 *       +(scene) SceneCuller
 *     }
 *     class SceneCuller {
 *       +scene : Scene
 *       +registerView(viewId, listener)
 *       +unregisterView(viewId)
 *       +postViewChanged(message)
 *       +objectIdAt(index) string
 *       +destroy()
 *     }
 *     class CullParams {
 *       +solidAngleLimit?   : number
 *       +cullEveryNUpdates? : number
 *     }
 *     class Scene {
 *       <<scene>>
 *     }
 *     ViewCuller o-- View : drives
 *     ViewCuller ..> getSceneCuller : uses
 *     getSceneCuller ..> SceneCuller : caches per Scene
 *     ViewCuller o-- SceneCuller : shares
 *     ViewCuller ..> CullParams : reads
 *     SceneCuller o-- Scene : observes
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Off the main thread** — the frustum and solid-angle tests run in a Web
 *   Worker. The main thread only posts frustums and applies the returned
 *   cull deltas.
 * - **Frustum + solid-angle** — an object is culled when its bounding sphere
 *   falls outside the view frustum, or subtends less than `solidAngleLimit`
 *   on screen. The size test is resolution-independent.
 * - **One worker per Scene** — {@link getSceneCuller} is a cached singleton;
 *   the bounds mirror (one sphere per object) is held once and shared by
 *   every View. The culler auto-destroys on `onSceneDestroyed`.
 * - **Per-view cull state** — each {@link viewing!viewer.View | View} culls its
 *   own camera against the shared mirror, so multi-view setups don't interfere.
 * - **Self-maintaining bounds** — the mirror follows scene mutations (objects
 *   added, removed, or moved) through the same events the
 *   {@link collision!SceneCollisionIndex | SceneCollisionIndex} observes, and
 *   reads bounds back from that index on a coalesced flush.
 * - **Throttled** — only every Nth camera change posts a pass, with a trailing
 *   "settled" pass once motion stops and at most one pass in flight at a time.
 * - **Independent of visibility** — culling drops a mesh from the draw index
 *   without disturbing {@link viewing!viewer.ViewObject.visible}, so toggling it
 *   never reveals an object the app deliberately hid.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Quick Start
 *
 * ### 1) Cull a View
 *
 * Construct a {@link ViewCuller} against the View. It starts culling at once and
 * self-destroys when the View is destroyed.
 *
 * ```javascript
 * import { ViewCuller } from "@xeokit/sdk/spatial/culling";
 *
 * const culler = new ViewCuller(view);
 * ```
 *
 * Call `culler.cullNow()` after adding many SceneObjects without moving the
 * camera, such as after a streaming chunk finishes, to classify newly resident
 * objects immediately.
 *
 * <br>
 *
 * ### 2) Tune the thresholds
 *
 * ```javascript
 * const culler = new ViewCuller(view, {
 *   solidAngleLimit:   0.01,  // cull small objects sooner
 *   cullEveryNUpdates: 5      // post a pass every 5th camera change
 * });
 * ```
 *
 * <br>
 *
 * ### 3) Stop culling
 *
 * Un-culls every object, restoring full visibility.
 *
 * ```javascript
 * culler.destroy();
 * ```
 *
 * <br>
 *
 * ### 4) Multiple Views
 *
 * One {@link ViewCuller} per {@link viewing!viewer.View | View}. They share a
 * single per-Scene worker and bounds mirror, reached internally through
 * {@link getSceneCuller}, but cull their own cameras independently.
 *
 * ```javascript
 * const cullerA = new ViewCuller(viewA);
 * const cullerB = new ViewCuller(viewB);   // same Scene, independent camera
 * ```
 *
 * @module culling
 */
export {ViewCuller} from "./ViewCuller";
export {SceneCuller, getSceneCuller, type CullingResultListener} from "./SceneCuller";
export {type CullParams, DEFAULT_CULL_PARAMS} from "./CullParams";
