/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fprocgen.svg)](https://badge.fury.io/js/%40xeokit%2Fprocgen)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/procgen/badge)](https://www.jsdelivr.com/package/npm/@xeokit/procgen)
 *
 * <img src="https://camo.githubusercontent.com/4de49a67a8e8cc6f74806d3364d451ac9cd9ccb29440ff14baf01d81da142033/68747470733a2f2f78656f6b69742e6769746875622e696f2f78656f6b69742d786b742d7574696c732f696d616765732f67656f6d6574727947656e65726174696f6e2e706e67"/>
 *
 * # xeokit SceneGeometry Builder Functions
 *
 * ---
 *
 * ### *Functions to generate various 3D geometric primitives*
 *
 * ---
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/procgen
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import {buildBoxGeometry} from "@xeokit/procgen";
 *
 * const geometryArrays = buildBoxGeometry({
 *     center: [0,0,0],
 *     xSize: 1,  // Half-size on each axis
 *     ySize: 1,
 *     zSize: 1
 * });
 * ````
 *
 * @module @xeokit/procgen
 */
export * from "./buildBoxGeometry";
export * from "./buildGridGeometry"
export * from "./buildBoxLinesGeometry";
export * from "./buildCylinderGeometry";
export * from "./buildSphereGeometry";
export * from "./buildTorusGeometry";
export * from "./buildVectorTextGeometry";
export * from "./buildPlaneGeometry";
export * from "./GeometryArrays";
