/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * <img style="padding:30px; padding-left: 0" src="media://images/kdtree.jpeg"/>
 *
 * # xeokit 3D Collision Utilities
 *
 * ---
 *
 * ### *Spatial searches and collision testing with 3D k-d trees, rays and boundaries*
 *
 * ---
 *
 * A {@link KdTree3} organizes items with 3D axis-aligned boundaries into a fast spatial search index that
 * allows us efficiently search it for items whose boundaries intersect given boundaries and volumes.
 *
 * This module provides the following functions to build KdTree3s:
 *
 * * {@link createPrimsKdTree3}: Creates a KdTree3 containing primitives from the given set of geometry arrays, organized by their coordinate 3D boundaries.
 * * {@link createSceneObjectPrimsKdTree3}: Creates a KdTree3 containing primitives belonging to the given SceneObjects, organized by their World-space 3D boundaries.
 * * {@link createSceneObjectsKdTree3}: Create a KdTree3 containing the given SceneObjects, organized by their World-space 3D boundaries.
 *
 * This module provides the following functions to search KdTree3s:
 *
 * * {@link searchKdTree3WithAABB}: Finds the items that collide with a given 3D axis-aligned boundary (AABB).
 * * {@link searchKdTree3WithFrustum}: Finds the items that collide with a given 3D frustum volume.
 * * {@link searchKdTree3WithRay}: Finds the items that collide with a given 3D ray.
 *
 * With these components, applications can implement (at least):
 *
 * * Frustum3 culling for {@link @xeokit/scene!SceneObject | SceneObjects}
 * * Ray-picking SceneObjects
 * * Marquee selection of SceneObjects
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/kdtree3
 * ````
 *
 * ## Dependencies
 *
 * * {@link "@xeokit/scene" | @xeokit/scene}
 * * {@link "@xeokit/core" | @xeokit/core}
 * * {@link "@xeokit/math" | @xeokit/math}
 * * {@link "@xeokit/boundaries" | @xeokit/boundaries}
 *
 * ## Usage
 *
 * Querying for {@link @xeokit/scene!SceneObject | SceneObjects} that intersect a 3D World-space boundary:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {SDKError} from "@xeokit/core";
 * import {TrianglesPrimitive} from "@xeokit/constants";
 * import {KdTree3, searchKdTree3WithAABB} from "@xeokit/kdtree3";
 *
 * const scene = new Scene();
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
 *         id: "theGeometry", primitive: TrianglesPrimitive,
 *         positions: [10.07, 0, 11.07, 9.58, 3.11, 11.07, 8.15, ..],
 *         indices: [21, 0, 1, 1, 22, 21, 22, 1, 2, 2, 23, 22, 23, ..]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "redLegMesh", geometryId: "theGeometry",
 *         position: [-4, -6, -4], scale: [1, 3, 1], rotation: [0, 0, 0], color: [1, 0.3, 0.3]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "greenLegMesh", geometryId: "theGeometry", position: [4, -6, -4], scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [0.3, 1.0, 0.3]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "blueLegMesh", geometryId: "theGeometry", position: [4, -6, 4],  scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [0.3, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "yellowLegMesh",  geometryId: "theGeometry", position: [-4, -6, 4], scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [1.0, 1.0, 0.0]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "tableTopMesh", geometryId: "theGeometry", position: [0, -3, 0], scale: [6, 0.5, 6],
 *         rotation: [0, 0, 0], color: [1.0, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createObject({ id: "redLegSceneObject", meshIds: ["redLegMesh"] });
 *     sceneModel.createObject({ id: "greenLegSceneObject", meshIds: ["greenLegMesh"] });
 *     sceneModel.createObject({ id: "blueLegSceneObject", meshIds: ["blueLegMesh"] });
 *     sceneModel.createObject({ id: "yellowLegSceneObject", meshIds: ["yellowLegMesh"] });
 *     sceneModel.createObject({ id: "tableTopSceneObject", meshIds: ["tableTopMesh"] });
 *
 *     sceneModel.build()
 *
 *         .then(() => {
 *
 *             const kdTree = createSceneObjectsKdTree3(Object.values(scene.objects));
 *
 *             const sceneObjects = searchKdTree3WithAABB({
 *                 kdTree,
 *                 aabb : [0, 0, 0, 10, 10, 10]
 *             });
 *
 *             const sceneObjects2 = searchKdTree3WithFrustum({
 *                 kdTree,
 *                 frustum: new Frustum3( .. )
 *             });
 *
 *             const objectMap = {};
 *
 *             for (let i = 0, len = sceneObjects.length; i < len; i++) {
 *                 const sceneObject = sceneObjects[i];
 *             }
 *
 *             const redLegSceneObject = objectMap["redLegSceneObject"];
 *             const greenLegSceneObject = objectMap["greenLegSceneObject"];
 *             const tableTopSceneObject = objectMap["tableTopSceneObject"];
 *         });
 * }
 * ````
 *
 * @module @xeokit/kdtree3
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


