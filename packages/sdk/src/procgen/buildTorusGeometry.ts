import {normalizeVec3, subVec3} from "../matrix";
import {apply} from "../utils";
import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "../constants";

/**
 * Creates a torus-shaped {@link scene!SceneGeometry | SceneGeometry}.
 *
 * This function generates a torus (doughnut shape) geometry by calculating the positions of vertices based on the specified parameters. It also calculates the normals and UV coordinates for each vertex. The resulting geometry can be used to render a torus mesh in 3D environments.
 *
 * ## Usage
 *
 * To create a torus geometry, call the function with the desired configuration. For example:
 *
 * ````javascript
 * const torusGeometry = buildTorusGeometry({
 *     radius: 2,
 *     tube: 0.5,
 *     radialSegments: 36,
 *     tubeSegments: 24,
 *     arc: Math.PI * 2,
 *     center: [0, 0, 0]
 * });
 * ````
 *
 * This creates a torus with a radius of 2 units, a tube radius of 0.5 units, 36 radial segments, and 24 tubular segments, with a full circle arc.
 *
 * ## Parameters:
 * @param cfg Configuration object for generating the torus geometry.
 * @param [cfg.center] A 3D point (array of 3 numbers) indicating the center position of the torus. Defaults to `[0, 0, 0]`.
 * @param [cfg.radius=1] The overall radius of the torus. This controls the distance from the center to the tube's center. Default is 1.
 * @param [cfg.tube=0.3] The radius of the tube that makes up the torus. Default is 0.3.
 * @param [cfg.radialSegments=32] The number of radial segments (segments along the circular cross-section). Default is 32.
 * @param [cfg.tubeSegments=24] The number of tubular segments (segments around the tube). Default is 24.
 * @param [cfg.arc=Math.PI*2] The length of the arc in radians, where `Math.PI*2` represents a full circle. Default is a full circle.
 *
 * ## Returns:
 * Returns a {@link scene!SceneGeometry | SceneGeometry} object containing the torus geometry with the necessary positions, indices, and optional normals and UV coordinates for rendering.
 *
 * ## Example:
 * ```javascript
 * const torusGeometry = buildTorusGeometry({
 *     radius: 1.5,
 *     tube: 0.4,
 *     radialSegments: 24,
 *     tubeSegments: 16,
 *     arc: Math.PI * 2,
 *     center: [0, 0, 0]
 * });
 * ```
 *
 * ## Notes:
 * - The geometry is created by iterating over both radial and tube segments, calculating the positions of vertices in 3D space, and connecting them with indices to form triangles.
 * - The arc parameter defines how much of the torus is created. A full circle corresponds to `Math.PI * 2`, and any smaller value creates a partial torus.
 * - The function calculates vertex normals using the difference between each vertex and the center of the torus.
 *
 * @returns {GeometryArrays} The geometry data for the torus, including positions, normals, and indices for rendering.
 */

export function buildTorusGeometry(cfg: {
  tube?: number;
  arc?: number;
  center?: number[];
  radialSegments?: number;
  radius?: number;
  tubeSegments?: number;
} = {
  radius: 0,
  tube: 0,
  radialSegments: 0,
  tubeSegments: 0,
  arc: 0,
  center: [0, 0, 0]
}): GeometryArrays {

  let radius = cfg.radius || 1;
  if (radius < 0) {
    console.error("negative radius not allowed - will invert");
    radius *= -1;
  }
  radius *= 0.5;

  let tube = cfg.tube || 0.3;
  if (tube < 0) {
    console.error("negative tube not allowed - will invert");
    tube *= -1;
  }

  let radialSegments = cfg.radialSegments || 32;
  if (radialSegments < 0) {
    console.error("negative radialSegments not allowed - will invert");
    radialSegments *= -1;
  }
  if (radialSegments < 4) {
    radialSegments = 4;
  }

  let tubeSegments = cfg.tubeSegments || 24;
  if (tubeSegments < 0) {
    console.error("negative tubeSegments not allowed - will invert");
    tubeSegments *= -1;
  }
  if (tubeSegments < 4) {
    tubeSegments = 4;
  }

  let arc = cfg.arc || Math.PI * 2;
  if (arc < 0) {
    console.warn("negative arc not allowed - will invert");
    arc *= -1;
  }
  if (arc > 360) {
    arc = 360;
  }

  const center = cfg.center;
  let centerX = center ? center[0] : 0;
  let centerY = center ? center[1] : 0;
  const centerZ = center ? center[2] : 0;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let u;
  let v;
  let x;
  let y;
  let z;
  let vec;

  let i;
  let j;

  // Iterate over tube segments and radial segments to calculate positions
  for (j = 0; j <= tubeSegments; j++) {
    for (i = 0; i <= radialSegments; i++) {

      u = i / radialSegments * arc; // Radial angle
      v = 0.785398 + (j / tubeSegments * Math.PI * 2); // Tube angle

      // Calculate center position of the torus
      centerX = radius * Math.cos(u);
      centerY = radius * Math.sin(u);

      // Calculate position of the vertex on the tube
      x = (radius + tube * Math.cos(v)) * Math.cos(u);
      y = (radius + tube * Math.cos(v)) * Math.sin(u);
      z = tube * Math.sin(v);

      positions.push(x + centerX);
      positions.push(y + centerY);
      positions.push(z + centerZ);

      uvs.push(1 - (i / radialSegments));
      uvs.push((j / tubeSegments));

      // Calculate normal vector
      vec = normalizeVec3(subVec3([x, y, z], [centerX, centerY, centerZ], []), []);

      normals.push(vec[0]);
      normals.push(vec[1]);
      normals.push(vec[2]);
    }
  }

  let a;
  let b;
  let c;
  let d;

  // Generate indices for the triangles of the torus
  for (j = 1; j <= tubeSegments; j++) {
    for (i = 1; i <= radialSegments; i++) {

      a = (radialSegments + 1) * j + i - 1;
      b = (radialSegments + 1) * (j - 1) + i - 1;
      c = (radialSegments + 1) * (j - 1) + i;
      d = (radialSegments + 1) * j + i;

      indices.push(a);
      indices.push(b);
      indices.push(c);

      indices.push(c);
      indices.push(d);
      indices.push(a);
    }
  }

  return apply(cfg, {
    primitive: TrianglesPrimitive, // The geometry is constructed as triangles
    positions: positions,
    normals: normals,
    uv: uvs,
    indices: indices
  });
}
