/**
 * #### Mesh generation functions
 *
 * ````javascript
 * import {buildBoxGeometry} from "@xeokit/math/geometry";
 *
 * const geometryArrays = buildBoxGeometry({
 *     center: [0,0,0],
 *     xSize: 1,  // Half-size on each axis
 *     ySize: 1,
 *     zSize: 1
 * });
 * ````
 *
 * @module @xeokit/math/geometry
 */
export * from "./geometry/buildBoxGeometry";
export * from "./geometry/buildBoxLinesGeometry";
export * from "./geometry/buildCylinderGeometry";
export * from "./geometry/buildSphereGeometry";
export * from "./geometry/buildTorusGeometry";
export * from "./geometry/buildVectorTextGeometry";
export * from "./geometry/GeometryArrays";