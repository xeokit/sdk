/**
 * # xeokit Scene Collision
 *
 * ---
 *
 * **Self-maintaining BVH spatial index over a
 * {@link model!scene.Scene | Scene}, plus a triangle-precise raycaster
 * layered on top. Ray, frustum, and AABB queries answer in
 * `O(log N)` while staying in lockstep with scene mutations.**
 *
 * ---
 *
 * The `collision` module attaches a hierarchical spatial index to an
 * existing {@link model!scene.Scene | Scene} so the host can answer
 * spatial questions — "which objects does this ray cross?", "which
 * are inside this camera frustum?", "what's at this canvas pixel?" —
 * without scanning every {@link model!scene.SceneObject | SceneObject}
 * each call.
 *
 * One index per Scene, retrieved via {@link getSceneCollisionIndex}.
 * The index subscribes to scene-mutation events and flags itself
 * dirty when objects move or come and go; the next query rebuilds
 * lazily, so a quiet scene pays no maintenance cost.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class getSceneCollisionIndex {
 *       +(scene) SceneCollisionIndex
 *     }
 *     class SceneCollisionIndex {
 *       +scene : Scene
 *       +intersectRay(origin, dir, opts?)
 *       +intersectFrustum(frustum)
 *       +intersectAABB(aabb)
 *       +forEachIntersectsRay(...)
 *       +getMeshAABB(mesh)
 *       +getObjectAABB(objectId)
 *       +getSceneAABB()
 *     }
 *     class SceneRaycaster {
 *       +pick(params) SceneRaycastResult
 *     }
 *     class intersectSceneRayTriangle {
 *       +(scene, origin, dir, opts?) SceneTriangleHit
 *     }
 *     class Scene {
 *       <<scene>>
 *     }
 *     getSceneCollisionIndex ..> SceneCollisionIndex : caches per Scene
 *     SceneCollisionIndex o-- Scene : observes
 *     SceneRaycaster ..> SceneCollisionIndex : routes
 *     intersectSceneRayTriangle ..> SceneCollisionIndex : routes
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **One index per Scene** — `getSceneCollisionIndex(scene)` is a
 *   cached singleton; subsequent calls return the same instance and
 *   the index auto-destroys on `onSceneDestroyed`.
 * - **Hierarchical BVH** — wraps every
 *   {@link model!scene.SceneObject | SceneObject} in the scene; ray /
 *   frustum / AABB queries answer in `O(log N)` against the tree.
 * - **Lazy rebuild** — creating, destroying, or moving an object
 *   marks the tree dirty; the next query rebuilds in `O(N log N)`.
 *   A quiet scene pays nothing.
 * - **Early-out fast paths** — nodes fully inside the query volume
 *   short-circuit without descending. Big-frustum / big-AABB queries
 *   become close to free.
 * - **Streaming visitors** — `forEachIntersects…` callbacks deliver
 *   hits as they're found so callers can stop on the first one
 *   (closest, frontmost, etc.) without materialising the full list.
 * - **Per-mesh + per-object AABBs** — `getMeshAABB(mesh)`,
 *   `getObjectAABB(objectId)`, `getSceneAABB()` reuse the index's
 *   cached AABBs without recomputing them.
 * - **Triangle-precise picking** — {@link SceneRaycaster} +
 *   {@link intersectSceneRayTriangle} layer a per-triangle raycast on
 *   top of the BVH for surface picks that need the exact world hit
 *   point, not just the candidate object.
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
 * ### 1) Import the entry points
 *
 * ```javascript
 * import {
 *   getSceneCollisionIndex,
 *   SceneRaycaster,
 *   intersectSceneRayTriangle
 * } from "@xeokit/sdk/spatial/collision";
 * ```
 *
 * <br>
 *
 * ### 2) Get the cached index for a Scene
 *
 * ```javascript
 * const collisionIndex = getSceneCollisionIndex(scene);
 * ```
 *
 * <br>
 *
 * ### 3) Ray-pick objects
 *
 * Returns every SceneObject the ray crosses, with the world-space hit
 * distance per object.
 *
 * ```javascript
 * const hits = collisionIndex.intersectRay([0, 5, -10], [0, 0, 1]);
 * console.log("Hit objects:", hits.map(h => h.objectId));
 * ```
 *
 * <br>
 *
 * ### 4) Frustum cull
 *
 * Pass any frustum (e.g. from the View's camera) to find the set of
 * objects whose AABB intersects it.
 *
 * ```javascript
 * import { setFrustum3 } from "@xeokit/sdk/base/math/boundaries";
 *
 * const frustum    = setFrustum3(view.camera.viewMatrix, view.camera.projMatrix);
 * const visibleIds = collisionIndex.intersectFrustum(frustum);
 * ```
 *
 * <br>
 *
 * ### 5) AABB region select
 *
 * ```javascript
 * const inBox = collisionIndex.intersectAABB([0, 0, 0, 5, 5, 5]);
 * ```
 *
 * <br>
 *
 * ### 6) Triangle-precise pick
 *
 * When the candidate-object answer isn't enough — e.g. you need the
 * exact world-space hit point on a mesh's surface — use the
 * triangle-precise path.
 *
 * ```javascript
 * const result = intersectSceneRayTriangle(scene, origin, dir);
 * if (result) {
 *   console.log("world hit:", result.worldPos, "on mesh", result.mesh.id);
 * }
 * ```
 *
 * @module collision
 */

export {SceneCollisionIndex} from "./SceneCollisionIndex";
export {getSceneCollisionIndex} from "./getSceneCollisionIndex";
export type {SceneCollisionRayHit} from "./SceneCollisionRayHit";
export type {SceneCollisionRayOptions} from "./SceneCollisionRayOptions";
export type {SceneCollisionVisitor} from "./SceneCollisionVisitor";

export {intersectSceneRayTriangle} from "./intersectSceneRayTriangle";
export type {SceneTriangleHit} from "./SceneTriangleHit";
export type {SceneRayTriangleOptions} from "./SceneRayTriangleOptions";

export {SceneRaycaster} from "./SceneRaycaster";
export type {SceneRaycastParams} from "./SceneRaycastParams";
export type {SceneRaycastResult} from "./SceneRaycastResult";
