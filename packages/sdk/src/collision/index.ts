/**
 * # xeokit Scene Collision
 *
 * Self-maintaining BVH index for ray, frustum, and AABB queries
 * against a {@link scene!Scene | Scene}, plus a triangle-precise
 * raycaster layered on top of it.
 *
 * ## Features
 *
 * - Hierarchical spatial index over every {@link scene!SceneObject |
 *   SceneObject} in a Scene.
 * - Lazy rebuild: any object created/destroyed/moved marks the tree
 *   dirty; the next query rebuilds in O(N log N).
 * - Ray, frustum, and AABB queries with early-out fast paths for
 *   nodes fully inside the query volume.
 * - Streaming `forEachIn…` visitors for first-hit / any-hit patterns.
 * - Per-mesh and per-object world-space AABB lookups, plus a scene
 *   centre helper.
 * - Triangle-precise raycaster ({@link SceneRaycaster}) for surface
 *   picking that needs the exact hit point, not just the candidate
 *   object.
 *
 * ## Usage
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { getSceneCollisionIndex } from "@xeokit/sdk/collision";
 * import { setFrustum3 } from "@xeokit/sdk/math/boundaries";
 *
 * const scene = new Scene();
 * // ...load model into scene...
 *
 * const collisionIndex = getSceneCollisionIndex(scene);
 *
 * // Ray pick the scene
 * const hits = collisionIndex.intersectRay([0, 5, -10], [0, 0, 1]);
 * console.log("Hit objects:", hits.map(h => h.objectId));
 *
 * // Frustum cull
 * const frustum = setFrustum3(view.camera.viewMatrix, view.camera.projMatrix);
 * const visibleIds = collisionIndex.intersectFrustum(frustum);
 *
 * // AABB region select
 * const ids = collisionIndex.intersectAABB([0, 0, 0, 5, 5, 5]);
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
