/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * <img style="padding:20px" src="media://images/geometry_icon.png"/>
 *
 * ## xeokit Geometry Compression / Decompression Utilities
 *
 * This library provides a set of functions that are used internally within
 * {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry} implementations to
 * compress geometry. The functions are provided here in case users instead want to pre-compress their geometry "offline",
 * and then use {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * to create the compressed geometry directly.
 *
 * ### kd-Tree
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/kdtree
 * ````
 *
 * ## Usage
 *
 *
 * ````javascript
 * const scene = new Scene();
 *
 * const kdTree = new KDTree({
 *      scene,
 * });
 *
 * const kdAABBQuery = new KDAABBQuery({
 *      kdTree
 * });
 *
 * kdAABBQuery.aabb = [-10,-10,-10, 10,10,10];
 *
 * kdAABBQuery.update();
 *
 * for (let i = 0, len = kdAABBQuery.objects.length; i < len; i++) {
 *     const sceneObject  = kdAABBQuery.objects[i];
 *
 *     //..
 * }
 * ````
 *
 * @module @xeokit/kdtree
 */

export * from "./KDTree";