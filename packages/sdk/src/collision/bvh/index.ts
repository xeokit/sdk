/**
 * # xeokit Scene Collision Index
 *
 * Self-maintaining bounding-volume hierarchy for fast ray, frustum, and
 * AABB queries against a {@link scene!Scene | Scene}.
 *
 * ## Features
 *
 * - Hierarchical spatial index over every {@link scene!SceneObject | SceneObject}
 *   in a Scene.
 * - Lazy rebuild: any object created/destroyed/moved marks the tree dirty;
 *   the next query rebuilds in O(N log N).
 * - Ray, frustum, and AABB queries with early-out fast paths for nodes
 *   fully inside the query volume.
 * - Streaming `forEachIn…` visitors for first-hit / any-hit patterns.
 *
 * ## Usage
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { getSceneCollisionIndex } from "@xeokit/sdk/collision/bvh";
 * import { setFrustum3, Frustum3 } from "@xeokit/sdk/math/boundaries";
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
 * @module collision/bvh
 */

export {
  SceneCollisionIndex,
  getSceneCollisionIndex,
  type SceneCollisionRayHit,
  type SceneCollisionRayOptions,
  type SceneCollisionVisitor
} from "./SceneCollisionIndex";

export {
  intersectSceneRayTriangle,
  type SceneTriangleHit,
  type SceneRayTriangleOptions
} from "./intersectSceneRayTriangle";

export {
  ScenePicker
} from "./ScenePicker";
export type {ScenePickParams} from "./ScenePickParams";
export type {ScenePickResult} from "./ScenePickResult";
