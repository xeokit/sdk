/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * <img style="padding:30px; height:160px;" src="media://images/kdtree3.png"/>
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
 * * Frustum3 culling for SceneObjects
 * * Ray-picking SceneObjects
 * * Marquee selection of SceneObjects
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqVUstuwjAQ_JVoTyBFCILJ6wZFvVSoB3pq04OxF0ib2NR2qlKUf6-TICUIWjV7sT07s7O29wRMcoQYWEa1XqZ0p2ieCMdGjTgPy8fNGzKjnxSic2pSVawZCmxyL6-ObEhtOhUalemQBp19RR_GzqdMeatgGVI1uIDLm53cq0KbIl9bOtt3W7rs9Z13Ti1p26hbQNd1BsO_LOfzxeLar5cvpZtNP9MVVR8F4rXvPx7nbk_FDnU_bXXLPsLuj_7GBBdyVDlNuR2ympSA2WOOCcR2y3FLi8wkkIjSUmlh5PooGMRGFehCceDU4HksId7STFsUeWqkWp0Ht1pcOFAB8Qm-IPb88WgyCUjoe7NoSoIpceFo4emIRIEfkohMwjCIQq904VtKW3Y8Cj2fEN-LSBCSGZlFdb3nOlk1Uv4AguP0dg?type=png)](https://mermaid.live/edit#pako:eNqVUstuwjAQ_JVoTyBFCILJ6wZFvVSoB3pq04OxF0ib2NR2qlKUf6-TICUIWjV7sT07s7O29wRMcoQYWEa1XqZ0p2ieCMdGjTgPy8fNGzKjnxSic2pSVawZCmxyL6-ObEhtOhUalemQBp19RR_GzqdMeatgGVI1uIDLm53cq0KbIl9bOtt3W7rs9Z13Ti1p26hbQNd1BsO_LOfzxeLar5cvpZtNP9MVVR8F4rXvPx7nbk_FDnU_bXXLPsLuj_7GBBdyVDlNuR2ympSA2WOOCcR2y3FLi8wkkIjSUmlh5PooGMRGFehCceDU4HksId7STFsUeWqkWp0Ht1pcOFAB8Qm-IPb88WgyCUjoe7NoSoIpceFo4emIRIEfkohMwjCIQq904VtKW3Y8Cj2fEN-LSBCSGZlFdb3nOlk1Uv4AguP0dg)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/collision
 * ````
 *
 * ## Dependencies
 *
 * * {@link "@xeokit/scene"}
 * * {@link "@xeokit/core/components"}
 * * {@link "@xeokit/math/math"}
 * * {@link "@xeokit/math/boundaries"}
 *
 * ## Usage
 *
 * Querying for SceneObjects that intersect a 3D World-space boundary:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {SDKError} from "@xeokit/core/components";
 * import {TrianglesPrimitive} from "@xeokit/core/dist/constants";
 * import {KdTree3, searchKdTree3WithAABB} from "@xeokit/collision/objects";
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
 *     sceneModel.createMesh({
 *         id: "redLegMesh", geometryId: "theGeometry",
 *         position: [-4, -6, -4], scale: [1, 3, 1], rotation: [0, 0, 0], color: [1, 0.3, 0.3]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "greenLegMesh", geometryId: "theGeometry", position: [4, -6, -4], scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [0.3, 1.0, 0.3]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "blueLegMesh", geometryId: "theGeometry", position: [4, -6, 4],  scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [0.3, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "yellowLegMesh",  geometryId: "theGeometry", position: [-4, -6, 4], scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [1.0, 1.0, 0.0]
 *     });
 *
 *     sceneModel.createMesh({
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
 * @module @xeokit/collision/kdtree3
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
export {PrimsKdTree3} from "./PrimsKdTree3";
export {SceneObjectsKdTree3} from "./sceneObjectsKdTree3";
export {KdNode3} from "./KdNode3";
export {KdItem3D} from "./KdItem3";
export {KdTree3Params} from "./KdTree3Params";


