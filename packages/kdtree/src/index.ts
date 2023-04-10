/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * <img style="padding:30px; height:160px;" src="media://images/kdtree.png"/>
 *
 * ## xeokit *k*-d Tree Spatial Query Utilities
 *
 * A {@link KDTree} automatically organizes a {@link @xeokit/scene!Scene | Scene}'s {@link @xeokit/scene!SceneObject | SceneObects}
 * into a fast spatial search index that allows us efficiently query it for SceneObjects that intersect given boundaries and volumes.
 *
 * These sorts of queries are useful for operations like view frustum culling and marquee selection.
 *
 * To query {@link @xeokit/scene!SceneObject | SceneObects} from a {@link KDTree}, this module provides the following command classes:
 *
 * * {@link KDTreeAABBQuery}: Finds the SceneObjects that intersect a given 3D axis-aligned boundary (AABB) in the World-space.
 * * {@link KDTreeFrustumQuery}: Finds the SceneObjects that intersect a given 3D frustum volume in the World-space.
 * * {@link KDTreeMarqueeQuery}: Finds the SceneObjects that intersect a given 2D marque boundary in the Canvas-space.
 *
 * Additionally, each of these command classes has a corresponding version that only reports the SceneObjects whose
 * intersection states have changed since the last query execution:
 *
 * * {@link KDTreeAABBDeltasQuery}: Finds each SceneObject whose intersection state has changed with respect to a given World-space 3D AABB.
 * * {@link KDTreeFrustumDeltasQuery}: Finds each SceneObject whose intersection state has changed with respect to a given World-space 3D frustum volume.
 * * {@link KDTreeMarqueeDeltasQuery}: Finds each SceneObject whose intersection state has changed with respect to a given Canvas-space 2D marque boundary.
 *
 * These delta queries are particularly useful for tracking changes in SceneObject intersection states, such as in the case
 * of a moving boundary or volume.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/kdtree
 * ````
 *
 * ## Usage
 *
 * Querying for SceneObjects that intersect a 3D World-space boundary:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {SDKError} from "@xeokit/core/components";
 * import {TrianglesPrimitive} from "@xeokit/core/dist/constants";
 * import {KDObjectTree, KDObjectTreeAABBSearch} from "@xeokit/kdtree";
 *
 * const scene = new Scene();
 *
 * const kdTree = new KDObjectTree({
 *      scene
 * });
 *
 * const aabbQuery = new KDObjectTreeAABBSearch({
 *      kdTree
 * });
 *
 * const sceneModel = scene.createModel({
 *      id: "myModel"
 * });
 *
 * if (sceneModel instanceof SDKError) {
 *      console.log(sceneModel.message);
 *
 * } else {
 *
 *     sceneModel.createGeometry({
 *         id: "theGeometry",
 *         primitive: TrianglesPrimitive,
 *         positions: [10.07, 0, 11.07, 9.58, 3.11, 11.07, 8.15, ..],
 *         indices: [21, 0, 1, 1, 22, 21, 22, 1, 2, 2, 23, 22, 23, ..]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "redLegMesh",
 *         geometryId: "theGeometry",
 *         position: [-4, -6, -4],
 *         scale: [1, 3, 1],
 *         rotation: [0, 0, 0],
 *         color: [1, 0.3, 0.3]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "greenLegMesh",
 *         geometryId: "theGeometry",
 *         position: [4, -6, -4],
 *         scale: [1, 3, 1],
 *         rotation: [0, 0, 0],
 *         color: [0.3, 1.0, 0.3]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "blueLegMesh",
 *         geometryId: "theGeometry",
 *         position: [4, -6, 4],
 *         scale: [1, 3, 1],
 *         rotation: [0, 0, 0],
 *         color: [0.3, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "yellowLegMesh",
 *         geometryId: "theGeometry",
 *         position: [-4, -6, 4],
 *         scale: [1, 3, 1],
 *         rotation: [0, 0, 0],
 *         color: [1.0, 1.0, 0.0]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "tableTopMesh",
 *         geometryId: "theGeometry",
 *         position: [0, -3, 0],
 *         scale: [6, 0.5, 6],
 *         rotation: [0, 0, 0],
 *         color: [1.0, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createObject({
 *         id: "redLegSceneObject",
 *         meshIds: ["redLegMesh"]
 *     });
 *
 *     sceneModel.createObject({
 *         id: "greenLegSceneObject",
 *         meshIds: ["greenLegMesh"]
 *     });
 *
 *     sceneModel.createObject({
 *         id: "blueLegSceneObject",
 *         meshIds: ["blueLegMesh"]
 *     });
 *
 *     sceneModel.createObject({
 *         id: "yellowLegSceneObject",
 *         meshIds: ["yellowLegMesh"]
 *     });
 *
 *     sceneModel.createObject({
 *         id: "tableTopSceneObject",
 *         meshIds: ["tableTopMesh"]
 *     });
 *
 *     sceneModel.build()
 *
 *         .then(() => {
 *
 *             aabbQuery.aabb = [0, 0, 0, 10, 10, 10]; // World-space 3D AABB
 *             aabbQuery.doQuery();
 *
 *             const objectMap = {};
 *
 *             for (let i = 0, len = aabbQuery.objects.length; i < len; i++) {
 *                 const sceneObject = aabbQuery.objects[i];
 *                 objectMap[sceneObject.id] = sceneObject;
 *             }
 *
 *             const redLegSceneObject = objectMap["redLegSceneObject"];
 *             const greenLegSceneObject = objectMap["greenLegSceneObject"];
 *             const tableTopSceneObject = objectMap["tableTopSceneObject"];
 *         });
 * }
 * ````
 *
 * @module @xeokit/kdtree
 */

export * from "./KDObjectTree";
export * from "./KDObjectNode";
export * from "./KDObjectTreeAABBSearch";
export * from "./KDTreeAABBDeltasQuery";
export * from "./KDTreeFrustumQuery";
export * from "./KDTreeFrustumDeltasQuery";
export * from "./KDTreeMarqueeQuery";
