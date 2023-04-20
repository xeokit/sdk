/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * <img style="padding:30px; height=200px;" src="media://images/kdtree2d.png"/>
 *
 * # xeokit 2D Collision Utilities
 *
 * ---
 *
 * ### *Tools for spatial searches and collision tests with 2D k-d trees and boundaries*
 *
 * ---
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
 * ````javascript
 *
 * ````
 *
 * @module @xeokit/collision/kdtree2
 */
export * from "./KdTree2";
export * from "./createKdTree2FromSceneObjectVerts";
export * from "./searchKdTree2ForNearestNeighbor";
export {KdVertex2} from "./KdVertex2";
