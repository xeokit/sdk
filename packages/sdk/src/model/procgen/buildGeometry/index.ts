/**
 * # Procedural Geometry Builders
 *
 * Functions that produce {@link model!scene.SceneGeometry | SceneGeometry}
 * input arrays for common 3D primitives — boxes, cylinders, spheres,
 * tori, grids, planes, line boxes, polygon-along-path extrusions,
 * surfaces of revolution, and extruded vector text. Each function
 * returns an {@link base!core.SDKResult | SDKResult} carrying a {@link GeometryArrays}
 * value (positions, normals, UVs, indices) ready to feed to
 * `SceneModel.createGeometry`.
 *
 * ## Usage
 *
 * ```ts
 * import {buildBox} from "@xeokit/sdk/model/procgen/buildGeometry";
 *
 * const result = buildBox({
 *   center: [0, 0, 0],
 *   xSize: 1,
 *   ySize: 1,
 *   zSize: 1
 * });
 *
 * if (result.ok) {
 *   const boxGeometry = result.value;
 *   // Pass to sceneModel.createGeometry(...)
 * } else {
 *   console.error("Error creating box geometry:", result.error);
 * }
 * ```
 *
 * @module geometry
 */
export * from "./buildBox";
export * from "./buildGrid";
export * from "./buildBoxLines";
export * from "./buildCylinder";
export * from "./buildExtrude";
export * from "./buildLathe";
export * from "./buildSphere";
export * from "./buildTorus";
export * from "./buildVectorText";
export * from "./buildPlane";
export * from "./GeometryArrays";
