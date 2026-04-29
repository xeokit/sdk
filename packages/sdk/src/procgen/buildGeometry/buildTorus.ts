import {normalizeVec3, subVec3, type Vec3} from "../../math/vector";
import {apply} from "../../utils";
import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "../../constants";
import {SDKErrorType, type SDKResult} from "../../core";

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
 * const torusGeometryResult = buildTorus({
 *     radius: 2,
 *     tube: 0.5,
 *     radialSegments: 36,
 *     tubeSegments: 24,
 *     arc: Math.PI * 2,
 *     center: [0, 0, 0]
 * });
 *
 * if (torusGeometryResult.ok) {
 *    const torusGeometry = torusGeometryResult.value;
 *    // Use torusGeometry here
 * } else {
 *    console.error("Error creating torus geometry:", torusGeometryResult.error);
 * }
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
 * const torusGeometryResult = buildTorus({
 *     radius: 1.5,
 *     tube: 0.4,
 *     radialSegments: 24,
 *     tubeSegments: 16,
 *     arc: Math.PI * 2,
 *     center: [0, 0, 0]
 * });
 *
 * if (torusGeometryResult.ok) {
 *   const torusGeometry = torusGeometryResult.value;
 *   // Use torusGeometry here
 * } else {
 *   console.error("Error creating torus geometry:", torusGeometryResult.error);
 * }
 * ```
 *
 * ## Notes:
 * - The geometry is created by iterating over both radial and tube segments, calculating the positions of vertices in 3D space, and connecting them with indices to form triangles.
 * - The arc parameter defines how much of the torus is created. A full circle corresponds to `Math.PI * 2`, and any smaller value creates a partial torus.
 * - The function calculates vertex normals using the difference between each vertex and the center of the torus.
 *
 * * @returns {SDKResult<GeometryArrays>} The geometry data for the torus, including positions, normals, UVs, and indices for rendering, or an error message.
 */
export function buildTorus(cfg: {
  tube?: number;
  arc?: number;
  center?: Vec3;
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
}): SDKResult<GeometryArrays> {
  let radius = cfg.radius || 1;
  if (radius < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildTorus] Negative radius not allowed."
    };
  }
  radius *= 0.5;

  let tube = cfg.tube || 0.3;
  if (tube < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildTorus] Negative tube not allowed."
    };
  }

  let radialSegments = cfg.radialSegments || 32;
  if (radialSegments < 4) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildTorus] radialSegments must be at least 4."
    };
  }

  let tubeSegments = cfg.tubeSegments || 24;
  if (tubeSegments < 4) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildTorus] tubeSegments must be at least 4."
    };
  }

  let arc = cfg.arc || Math.PI * 2;
  if (arc <= 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildTorus] Arc must be greater than 0."
    };
  }

  const center = cfg.center || [0, 0, 0];

  if (center.length !== 3) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildTorus] Center must be a 3D point [x, y, z]."
    };
  }

  const centerX = center[0];
  const centerY = center[1];
  const centerZ = center[2];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= tubeSegments; j++) {
    for (let i = 0; i <= radialSegments; i++) {
      const u = (i / radialSegments) * arc;
      const v = (j / tubeSegments) * Math.PI * 2;

      const x = (radius + tube * Math.cos(v)) * Math.cos(u);
      const y = (radius + tube * Math.cos(v)) * Math.sin(u);
      const z = tube * Math.sin(v);

      positions.push(x + centerX, y + centerY, z + centerZ);

      const vec = subVec3([x, y, z], [radius * Math.cos(u), radius * Math.sin(u), 0]);
      normals.push(...normalizeVec3(vec));

      uvs.push(i / radialSegments, j / tubeSegments);
    }
  }

  for (let j = 1; j <= tubeSegments; j++) {
    for (let i = 1; i <= radialSegments; i++) {
      const a = (radialSegments + 1) * j + i - 1;
      const b = (radialSegments + 1) * (j - 1) + i - 1;
      const c = (radialSegments + 1) * (j - 1) + i;
      const d = (radialSegments + 1) * j + i;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometryArrays: GeometryArrays = apply(cfg, {
    primitive: TrianglesPrimitive,
    positions,
    normals,
    uv: uvs,
    indices
  });

  return { ok: true, value: geometryArrays };
}
