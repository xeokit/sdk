/**
 * <img style="padding:30px; padding-left:0;" src="https://xeokit.github.io/sdk/docs/assets/kdtree.png"/>
 *
 * # kdtree3 — 3D Spatial Search & Collision Utilities
 *
 * ---
 *
 * **Efficient spatial querying and coarse collision detection using 3D k-d trees, rays, and bounding volumes**
 *
 * ---
 *
 * ## What this module provides
 *
 * This module centers around {@link KdTree3}, a k-d tree that indexes items by their **axis-aligned bounding boxes (AABBs)**.
 * Building a `KdTree3` up-front lets you run fast queries such as:
 *
 * - “Which objects intersect this AABB?”
 * - “Which objects are inside (or intersect) the camera frustum?”
 * - “Which objects does this picking ray hit?”
 *
 * In practice, this is a high-performance way to *reduce the number of candidates* before doing more expensive, exact tests.
 *
 * ## Build a k-d tree
 *
 * Choose one of the builders depending on what you want to index:
 *
 * - {@link createPrimsKdTree3} — Indexes **geometry primitives** (triangles/lines/points) from raw arrays.
 * - {@link createSceneObjectPrimsKdTree3} — Indexes **primitives belonging to `SceneObjects`**, using world-space bounds.
 * - {@link createSceneObjectsKdTree3} — Indexes **whole `SceneObjects`**, using their world-space bounds.
 *
 * ## Query a k-d tree
 *
 * Once built, you can query the tree with common spatial volumes:
 *
 * - {@link searchKdTree3WithAABB} — Finds items whose AABB intersects a given AABB.
 * - {@link searchKdTree3WithFrustum} — Finds items intersecting a frustum (useful for culling/selection).
 * - {@link searchKdTree3WithRay} — Finds items intersecting a ray (useful for picking).
 *
 * ## Typical use cases
 *
 * - **Frustum culling** to quickly find potentially visible {@link scene!SceneObject | SceneObjects}
 * - **Ray picking** to find selection candidates under the cursor
 * - **Marquee / box selection** using an AABB or frustum derived from screen-space drag
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Example: find SceneObjects intersecting an AABB
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/scene";
 * import { TrianglesPrimitive } from "@xeokit/sdk/constants";
 * import { createSceneObjectsKdTree3, searchKdTree3WithAABB } from "@xeokit/sdk/kdtree3";
 *
 * // 1) Build a simple scene with one object
 * const scene = new Scene();
 * const sceneModel = scene.createModel({ id: "myModel" }).value;
 *
 * sceneModel.createGeometry({
 *   id: "theGeometry",
 *   primitive: TrianglesPrimitive,
 *   positions: [10.07, 0, 11.07, 9.58, 3.11, 11.07, 8.15 ...],
 *   indices:   [21, 0, 1, 1, 22, 21, 22, 1, 2, 2, 23, 22, 23 ...]
 * });
 *
 * sceneModel.createMesh({
 *   id: "tableTopMesh",
 *   geometryId: "theGeometry",
 *   position: [0, -3, 0],
 *   scale: [6, 0.5, 6],
 *   rotation: [0, 0, 0],
 *   color: [1.0, 0.3, 1.0]
 * });
 *
 * sceneModel.createObject({
 *   id: "tableTopSceneObject",
 *   meshIds: ["tableTopMesh"]
 * });
 *
 * // 2) Build a KdTree3 over all SceneObjects in the scene
 * const kdTree = createSceneObjectsKdTree3(Object.values(scene.objects));
 *
 * // 3) Query candidates intersecting an AABB
 * const intersectingObjects = searchKdTree3WithAABB({
 *   kdTree,
 *   aabb: [0, 0, 0, 10, 10, 10]
 * });
 *
 * console.log(intersectingObjects);
 * ```
 *
 * @module kdtree3
 */
export * from "./KdTree3";
export * from "./createSceneObjectsKdTree3";
export * from "./createSceneObjectPrimsKdTree3";
export * from "./createPrimsKdTree3";
export * from "./searchKdTree3WithAABB";
export * from "./searchKdTree3WithFrustum";
export * from "./searchKdTree3WithRay";
export * from "./KdSceneObjectPrim";
export * from "./KdTrianglePrim";
export * from "./KdLinePrim";
export * from "./KdPointPrim";
export * from "./PrimsKdTree3";
export * from "./sceneObjectsKdTree3";
export * from "./KdNode3";
export * from "./KdItem3";
export * from "./KdTree3Params";
