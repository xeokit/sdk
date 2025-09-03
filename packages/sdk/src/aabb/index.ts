/**
 * <img src="http://xeokit.io/img/kdtree.jpeg" />
 *
 * # xeokit Scene AABB Index
 *
 * ---
 *
 * **Tools for managing and computing Axis-Aligned Bounding Boxes (AABB) for 3D scenes.**
 *
 * ---
 *
 * **Features:**
 * - Efficient caching and lazy evaluation of AABBs for SceneMeshes and SceneObjects.
 * - World-space AABB computation for compressed geometry.
 * - Scene-wide AABB and center calculations.
 * - Dynamic updates based on scene events.
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage Example
 *
 * ```typescript
 * import { Scene } from "@xeokit/sdk/scene";
 * import { SceneAABB3Index, getSceneAABBIndex } from "@xeokit/sdk/aabb";
 * import {TrianglesPrimitive } from "@xeokit/sdk/constants";
 *
 * // Create a new Scene
 *
 * const scene = new Scene({ });
 *
 * const sceneModel = scene.createModel({
 *     id: "demoModel"
 * });
 *
 * sceneModel.createGeometry({
 *   id: "boxGeometry",
 *   primitive: TrianglesPrimitive,
 *   positions: [...],
 *   indices: [... ]
 * });
 *
 * sceneModel.createMesh({
 *   id: "boxMesh",
 *   geometryId: "boxGeometry",
 *   color: [1.0, 0.0, 0.0]
 * });
 *
 * sceneModel.createObject({
 *   id: "object1",
 *   meshIds: ["boxMesh"]
 * });
 *
 * // Create a SceneAABB3Index for the Scene
 *
 * const sceneAABBIndex = getSceneAABBIndex(scene);
 *
 * // Get the AABB for the entire Scene
 *
 * const sceneAABB = sceneAABBIndex.getSceneAABB();
 * console.log("Scene AABB:", sceneAABB);
 *
 * // Get the center of the Scene's AABB
 *
 * const sceneCenter = sceneAABBIndex.getSceneCenter();
 * console.log("Scene Center:", sceneCenter);
 *
 * // Get the AABB for a specific SceneObject
 *
 * const objectAABB = sceneAABBIndex.getObjectAABB("object1");
 * console.log("Object1 AABB:", objectAABB);
 *
 * // Get the combined AABB for multiple SceneObjects
 *
 * const combinedAABB = sceneAABBIndex.getCombinedObjectAABB(["object1", "object2"]);
 * console.log("Combined AABB:", combinedAABB);
 *
 * // Destroy the tileIndex when no longer needed. The tileIndex also
 * // destructs automatically when the Scene is destroyed.
 *
 * sceneAABBIndex.destroy();
 * ```
 *
 * @module aabb
 */

export {getSceneAABBIndex, SceneAABB3Index} from "./SceneAABB3Index";
export {createSceneObjectAABB3} from "./createSceneObjectAABB3";



