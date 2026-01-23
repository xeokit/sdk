/**
 * <img style="padding:30px; padding-left:0;" src="https://xeokit.github.io/sdk/docs/assets/kdtree.png"/>
 *
 * # xeokit Scene AABB3 Index
 *
 * ---
 *
 * **Utilities for computing and managing Axis-Aligned Bounding Boxes (AABB) in xeokit scenes.**
 *
 * ---
 *
 * The Scene AABB3 Index provides fast, centralized access to bounding boxes for
 * entire scenes, individual objects, and meshes. It keeps these bounds up to date
 * as the scene changes, making it useful for view framing, spatial queries, and
 * scene analysis.
 *
 * ## Features
 *
 * - Computes and maintains AABBs for {@link scene!Scene | Scene},
 *   {@link scene!SceneObject | SceneObject}, and {@link scene!SceneMesh | SceneMesh}.
 * - Supports world-space AABB calculation for compressed geometry.
 * - Provides scene-wide bounds and center point calculations.
 * - Automatically updates in response to scene lifecycle events.
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * This section walks through creating a scene, populating it with geometry,
 * and querying bounding boxes using the Scene AABB3 Index.
 *
 * ---
 *
 * ### Step 1: Import required modules
 *
 * Import the Scene API, the AABB index helpers, and any constants needed
 * to define geometry.
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { SceneAABB3Index, getSceneAABB3Index } from "@xeokit/sdk/aabb";
 * import { TrianglesPrimitive } from "@xeokit/sdk/constants";
 * ```
 *
 * ---
 *
 * ### Step 2: Create a Scene and SceneModel
 *
 * Create a new Scene, then create a SceneModel to hold geometry and objects.
 *
 * ```ts
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
 * ```
 *
 * ---
 *
 * ### Step 3: Define geometry and meshes
 *
 * Create geometry, attach it to a mesh, and then reference that mesh from
 * a SceneObject.
 *
 * ```ts
 * sceneModel.createGeometry({
 *   id: "boxGeometry",
 *   primitive: TrianglesPrimitive,
 *   positions: [...],
 *   indices: [...]
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
 * ```
 *
 * ---
 *
 * ### Step 4: Create or retrieve the SceneAABB3Index
 *
 * Obtain a SceneAABB3Index for the Scene. If one already exists, it will
 * be reused automatically.
 *
 * ```ts
 * const sceneAABB3Index = getSceneAABB3Index(scene);
 * ```
 *
 * ---
 *
 * ### Step 5: Query scene-level bounds
 *
 * Retrieve the axis-aligned bounding box for the entire Scene, as well as
 * its center point.
 *
 * ```ts
 * const sceneAABB = sceneAABB3Index.getSceneAABB();
 * console.log("Scene AABB:", sceneAABB);
 *
 * const sceneCenter = sceneAABB3Index.getSceneCenter();
 * console.log("Scene Center:", sceneCenter);
 * ```
 *
 * ---
 *
 * ### Step 6: Query object-level bounds
 *
 * Get the AABB for a single SceneObject by ID.
 *
 * ```ts
 * const objectAABB = sceneAABB3Index.getObjectAABB("object1");
 * console.log("Object1 AABB:", objectAABB);
 * ```
 *
 * You can also compute a combined bounding box for multiple objects.
 *
 * ```ts
 * const combinedAABB =
 *   sceneAABB3Index.getCombinedObjectAABB(["object1", "object2"]);
 *
 * console.log("Combined AABB:", combinedAABB);
 * ```
 *
 * ---
 *
 * ### Step 7: Clean up
 *
 * When the index is no longer needed, destroy it explicitly.
 * The index will also be destroyed automatically when the Scene itself
 * is destroyed.
 *
 * ```ts
 * sceneAABB3Index.destroy();
 * ```
 *
 * ---
 *
 * @module aabb
 */

export {getSceneAABB3Index, SceneAABB3Index} from "./SceneAABB3Index";
export {createSceneObjectAABB3} from "./createSceneObjectAABB3";



