/**
 * <img style="padding:30px; padding-left:0;" src="https://xeokit.github.io/sdk/docs/assets/kdtree.jpeg"/>
 *
 * # xeokit 3D Collision Utilities
 *
 * ---
 *
 * ***Efficient spatial searching and collision detection using 3D k-d trees, rays, and boundaries.***
 *
 * ---
 *
 * The {@link KdTree3} provides a fast spatial search tileIndex that organizes 3D objects with axis-aligned boundaries,
 * allowing efficient queries for intersections with other objects, volumes, and rays.
 *
 * ## Features
 *
 * This module includes functions for building and searching `KdTree3` instances:
 *
 * **Building KdTree3s:**
 * * {@link createPrimsKdTree3} - Creates a `KdTree3` containing primitives from geometry arrays, organized by their 3D boundaries.
 * * {@link createSceneObjectPrimsKdTree3} - Creates a `KdTree3` containing primitives from `SceneObjects`, organized by their world-space boundaries.
 * * {@link createSceneObjectsKdTree3} - Creates a `KdTree3` containing `SceneObjects`, organized by their world-space boundaries.
 *
 * **Searching KdTree3s:**
 * * {@link searchKdTree3WithAABB} - Finds objects intersecting a given 3D axis-aligned bounding box (AABB).
 * * {@link searchKdTree3WithFrustum} - Finds objects intersecting a given 3D frustum volume.
 * * {@link searchKdTree3WithRay} - Finds objects intersecting a given 3D ray.
 *
 * ## Use Cases
 * With these utilities, applications can implement:
 * * **Frustum culling** for {@link scene!SceneObject | SceneObjects}
 * * **Ray-picking** for object selection
 * * **Marquee selection** of multiple objects
 *
 * ## Installation
 *
 * Install the xeokit SDK:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage Example
 *
 * Searching for {@link scene!SceneObject | SceneObjects} intersecting a 3D world-space boundary:
 *
 * ````javascript
 * import { Scene } from "@xeokit/sdk/scene";
 * import { SDKError } from "@xeokit/sdk/core";
 * import { TrianglesPrimitive } from "@xeokit/sdk/constants";
 * import { createSceneObjectsKdTree3, searchKdTree3WithAABB } from "@xeokit/sdk/kdtree3";
 *
 * const scene = new Scene();
 * const sceneModel = scene.createModel({ id: "myModel" });
 *
 * if (sceneModel instanceof SDKError) {
 *     console.error(sceneModel.message);
 * } else {
 *     sceneModel.createGeometry({
 *         id: "theGeometry",
 *         primitive: TrianglesPrimitive,
 *         positions: [10.07, 0, 11.07, 9.58, 3.11, 11.07, 8.15, ...],
 *         indices: [21, 0, 1, 1, 22, 21, 22, 1, 2, 2, 23, 22, 23, ...]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "tableTopMesh",
 *         geometryId: "theGeometry",
 *         position: [0, -3, 0],
 *         scale: [6, 0.5, 6],
 *         rotation: [0, 0, 0],
 *         color: [1.0, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createObject({
 *         id: "tableTopSceneObject",
 *         meshIds: ["tableTopMesh"]
 *     });
 *
 *     const kdTree = createSceneObjectsKdTree3(Object.values(scene.objects));
 *
 *     const intersectingObjects = searchKdTree3WithAABB({
 *         kdTree,
 *         aabb: [0, 0, 0, 10, 10, 10]
 *     });
 *
 *     console.log(intersectingObjects);
 * }
 * ````
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
