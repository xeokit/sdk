/**
 * <img src="http://xeokit.io/img/kdtree.jpeg" />
 *
 * # xeokit Scene AABB3 Index
 *
 * ---
 *
 * **Tools for managing and computing Axis-Aligned Bounding Boxes (AABB) for 3D scenes.**
 *
 * ---
 *
 * **Features:**
 *
 * - Comprehensive AABB management for {@link scene!Scene}, {@link SceneObject}, and {@link SceneMesh} instances.
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
 * import { SceneAABB3Index, getSceneAABB3Index } from "@xeokit/sdk/aabb";
 * import {TrianglesPrimitive } from "@xeokit/sdk/constants";
 *
 * // Create a new Scene
 *
 * const scene = new Scene();
 *
 * const sceneModelResult = scene.createModel({
 *     id: "demoModel"
 * });
 *
 * if (!sceneModelResult.ok) {
 *   console.error("Failed to create model:", sceneModelResult.error);
 * }
 *
 * const sceneModel = sceneModelResult.value;
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
 * const sceneAABB3Index = getSceneAABB3Index(scene);
 *
 * // Get the AABB for the entire Scene
 *
 * const sceneAABB = sceneAABB3Index.getSceneAABB();
 * console.log("Scene AABB:", sceneAABB);
 *
 * // Get the center of the Scene's AABB
 *
 * const sceneCenter = sceneAABB3Index.getSceneCenter();
 * console.log("Scene Center:", sceneCenter);
 *
 * // Get the AABB for a specific SceneObject
 *
 * const objectAABB = sceneAABB3Index.getObjectAABB("object1");
 * console.log("Object1 AABB:", objectAABB);
 *
 * // Get the combined AABB for multiple SceneObjects
 *
 * const combinedAABB = sceneAABB3Index.getCombinedObjectAABB(["object1", "object2"]);
 * console.log("Combined AABB:", combinedAABB);
 *
 * // Destroy the tileIndex when no longer needed. The tileIndex also
 * // destructs automatically when the Scene is destroyed.
 *
 * sceneAABB3Index.destroy();
 * ```
 *
 * @module aabb
 */

export {getSceneAABB3Index, SceneAABB3Index} from "./SceneAABB3Index";
export {createSceneObjectAABB3} from "./createSceneObjectAABB3";



