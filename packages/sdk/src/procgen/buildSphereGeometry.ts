import * as utils from "../utils";
import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "../constants";

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
 * const sphereGeometry = buildSphereGeometry({
 *     radius: 2,
 *     heightSegments: 24,
 *     widthSegments: 18,
 *     center: [0, 0, 0]
 * });
 * ````
 *
 * ## Notes:
 * - The sphere is created by iterating over latitudinal and longitudinal segments to calculate the positions of vertices.
 * - Normals are calculated as the unit vectors pointing outward from the center of the sphere.
 * - UV coordinates are mapped to the sphere based on the latitude and longitude of each vertex.
 * - Indices are generated to create triangles from the vertices.
 *
 * @returns {GeometryArrays} The geometry data for the sphere, including positions, normals, UV coordinates, and indices.
 */
export function buildSphereGeometry(cfg: {
  center: number[];
  heightSegments: number;
  radius: number;
  widthSegments: number;
} = {
  heightSegments: 18,
  widthSegments: 18,
  radius: 1,
  center: [0, 0, 0]
}): GeometryArrays {

  const centerX = cfg.center ? cfg.center[0] : 0;
  const centerY = cfg.center ? cfg.center[1] : 0;
  const centerZ = cfg.center ? cfg.center[2] : 0;

  let radius = cfg.radius || 1;
  if (radius < 0) {
    console.error("negative radius not allowed - will invert");
    radius *= -1;
  }

  let heightSegments = cfg.heightSegments || 18;
  if (heightSegments < 0) {
    console.error("negative heightSegments not allowed - will invert");
    heightSegments *= -1;
  }
  heightSegments = Math.floor(heightSegments);
  if (heightSegments < 18) {
    heightSegments = 18;
  }

  let widthSegments = cfg.widthSegments || 18;
  if (widthSegments < 0) {
    console.error("negative widthSegments not allowed - will invert");
    widthSegments *= -1;
  }
  widthSegments = Math.floor(widthSegments);
  if (widthSegments < 18) {
    widthSegments = 18;
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let i;
  let j;

  let theta;
  let sinTheta;
  let cosTheta;

  let phi;
  let sinPhi;
  let cosPhi;

  let x;
  let y;
  let z;

  let u;
  let v;

  let first;
  let second;

  // Generate the vertices, normals, and UVs
  for (i = 0; i <= heightSegments; i++) {
    theta = i * Math.PI / heightSegments;
    sinTheta = Math.sin(theta);
    cosTheta = Math.cos(theta);

    for (j = 0; j <= widthSegments; j++) {
      phi = j * 2 * Math.PI / widthSegments;
      sinPhi = Math.sin(phi);
      cosPhi = Math.cos(phi);

      x = cosPhi * sinTheta;
      y = cosTheta;
      z = sinPhi * sinTheta;
      u = 1.0 - j / widthSegments;
      v = i / heightSegments;

      normals.push(x);
      normals.push(y);
      normals.push(z);

      uvs.push(u);
      uvs.push(v);

      positions.push(centerX + radius * x);
      positions.push(centerY + radius * y);
      positions.push(centerZ + radius * z);
    }
  }

  // Generate the indices for the triangles
  for (i = 0; i < heightSegments; i++) {
    for (j = 0; j < widthSegments; j++) {
      first = (i * (widthSegments + 1)) + j;
      second = first + widthSegments + 1;

      indices.push(first + 1);
      indices.push(second + 1);
      indices.push(second);
      indices.push(first + 1);
      indices.push(second);
      indices.push(first);
    }
  }

  return utils.apply(cfg, {
    primitive: TrianglesPrimitive, // The geometry is created as triangles
    positions: positions,
    normals: normals,
    uv: uvs,
    indices: indices
  });
}
