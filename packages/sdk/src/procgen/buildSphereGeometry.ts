import * as utils from "../utils";
import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "../constants";
import {SDKErrorType, SDKResult} from "../core";

/**
 * Creates a sphere-shaped geometry.
 *
 * This function generates a sphere geometry by calculating the positions of vertices based on the specified parameters. The sphere is defined by its radius and the number of latitudinal and longitudinal segments. The resulting geometry includes the positions, normals, UVs, and indices necessary to render the sphere.
 *
 * ## Usage
 *
 * To create a sphere geometry, call the function with the desired configuration. For example:
 *
 * ```javascript
 * const sphereGeometry = buildSphereGeometry({
 *     radius: 2,
 *     heightSegments: 24,
 *     widthSegments: 18,
 *     center: [0, 0, 0]
 * });
 * ```
 *
 * This creates a sphere with a radius of 2 units, 24 latitudinal segments, 18 longitudinal segments, centered at `[0, 0, 0]`.
 *
 * ## Parameters:
 * @param cfg Configuration object for generating the sphere geometry.
 * @param [cfg.center] A 3D point (array of 3 numbers) indicating the center position of the sphere. Defaults to `[0, 0, 0]`.
 * @param [cfg.radius=1] The radius of the sphere. Default is 1.
 * @param [cfg.heightSegments=24] The number of latitudinal segments (bands from top to bottom). Default is 24.
 * @param [cfg.widthSegments=18] The number of longitudinal segments (bands around the sphere). Default is 18.
 *
 * ## Returns:
 * Returns a {@link scene!SceneGeometry | SceneGeometry} object containing the sphere geometry with the necessary positions, normals, UV coordinates, and indices for rendering.
 *
 * ## Example:
 * ```javascript
 * const sphereGeometryResult = buildSphereGeometry({
 *     radius: 2,
 *     heightSegments: 24,
 *     widthSegments: 18,
 *     center: [0, 0, 0]
 * });
 *
 * if (sphereGeometryResult.ok) {
 *   const sphereGeometry = sphereGeometryResult.value;
 *   // Use sphereGeometry here
 * } else {
 *   console.error("Error creating sphere geometry:", sphereGeometryResult.error);
 * }
 * ````
 *
 * ## Notes:
 * - The sphere is created by iterating over latitudinal and longitudinal segments to calculate the positions of vertices.
 * - Normals are calculated as the unit vectors pointing outward from the center of the sphere.
 * - UV coordinates are mapped to the sphere based on the latitude and longitude of each vertex.
 * - Indices are generated to create triangles from the vertices.
 *
 * @returns {SDKResult<GeometryArrays>} The geometry data for the sphere, including positions, normals, UVs, and indices for rendering, or an error message.
 */

export function buildSphereGeometry(cfg: {
  center?: number[];
  heightSegments?: number;
  radius?: number;
  widthSegments?: number;
} = {
  heightSegments: 18,
  widthSegments: 18,
  radius: 1,
  center: [0, 0, 0]
}): SDKResult<GeometryArrays> {

  const center = cfg.center;
  if (center && center.length !== 3) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildSphereGeometry] Center must be a 3D point [x, y, z]."
    };
  }

  const centerX = center ? center[0] : 0;
  const centerY = center ? center[1] : 0;
  const centerZ = center ? center[2] : 0;

  let radius = cfg.radius || 1;
  if (radius < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildSphereGeometry] Negative radius not allowed."
    };
  }

  let heightSegments = cfg.heightSegments || 18;
  if (heightSegments < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildSphereGeometry] Negative heightSegments not allowed."
    };
  }
  heightSegments = Math.floor(heightSegments);
  if (heightSegments < 18) {
    heightSegments = 18;
  }

  let widthSegments = cfg.widthSegments || 18;
  if (widthSegments < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildSphereGeometry] Negative widthSegments not allowed."
    };
  }
  widthSegments = Math.floor(widthSegments);
  if (widthSegments < 18) {
    widthSegments = 18;
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= heightSegments; i++) {
    const theta = (i * Math.PI) / heightSegments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let j = 0; j <= widthSegments; j++) {
      const phi = (j * 2 * Math.PI) / widthSegments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      const u = j / widthSegments;
      const v = i / heightSegments;

      positions.push(radius * x + centerX, radius * y + centerY, radius * z + centerZ);
      normals.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < widthSegments; j++) {
      const first = i * (widthSegments + 1) + j;
      const second = first + widthSegments + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  const geometryArrays: GeometryArrays = utils.apply(cfg, {
    primitive: TrianglesPrimitive,
    positions,
    normals,
    uv: uvs,
    indices
  });

  return { ok: true, value: geometryArrays };
}
