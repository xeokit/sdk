import * as utils from "../utils";
import type {GeometryArrays} from "./GeometryArrays";
import {SDKErrorType, SDKResult} from "../core";

/**
 * Creates a plane-shaped geometry.
 *
 * This function generates a plane geometry with configurable dimensions and segments. The plane is created by defining a grid of vertices
 * with associated normals and UV coordinates, and creating the indices to connect them in a grid-like fashion. The plane is then returned
 * as a geometry that can be used to create a mesh in the scene.
 *
 * ## Usage
 *
 * ````javascript
 * const planeGeometryResult = buildPlaneGeometry({
 *     xSize: 10,              // Width of the plane
 *     zSize: 10,              // Depth of the plane
 *     xSegments: 10,          // Number of segments along the X-axis
 *     zSegments: 10,          // Number of segments along the Z-axis
 *     center: [0, 0, 0]       // Center position of the plane in 3D space
 * });
 *
 * if (planeGeometryResult.ok) {
 *    const planeGeometry = planeGeometryResult.value;
 *    // Use planeGeometry here
 * } else {
 *    console.error("Error creating plane geometry:", planeGeometryResult.error);
 * }
 * ````
 *
 * @param cfg Configuration for the plane geometry.
 * @param [cfg.center=[0, 0, 0]] The 3D point indicating the center of the plane.
 * @param [cfg.xSize=1] The width of the plane along the X-axis. Default is `1`.
 * @param [cfg.zSize=1] The depth of the plane along the Z-axis. Default is `1`.
 * @param [cfg.xSegments=1] The number of segments along the X-axis. Default is `1`.
 * @param [cfg.zSegments=1] The number of segments along the Z-axis. Default is `1`.
 * @returns {SDKResult<GeometryArrays, string>} The geometry arrays for the plane, including positions, normals, UVs, and indices, or an error message.
 */
export function buildPlaneGeometry(cfg = {
  xSize: 1,
  zSize: 1,
  xSegments: 1,
  zSegments: 1,
  center: [0, 0, 0]
}): SDKResult<GeometryArrays, string> {
  let xSize = cfg.xSize || 1;
  if (xSize < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidParameter,
      error: "Negative xSize not allowed."
    };
  }

  let zSize = cfg.zSize || 1;
  if (zSize < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidParameter,
      error: "Negative zSize not allowed."
    };
  }

  let xSegments = cfg.xSegments || 1;
  if (xSegments < 1) {
    return {
      ok: false,
      type: SDKErrorType.InvalidParameter,
      error: "xSegments must be at least 1."
    };
  }

  let zSegments = cfg.zSegments || 1;
  if (zSegments < 1) {
    return {
      ok: false,
      type: SDKErrorType.InvalidParameter,
      error: "zSegments must be at least 1."
    };
  }

  const center = cfg.center;
  const centerX = center ? center[0] : 0;
  const centerY = center ? center[1] : 0;
  const centerZ = center ? center[2] : 0;

  const halfWidth = xSize / 2;
  const halfHeight = zSize / 2;

  const planeX = Math.floor(xSegments);
  const planeZ = Math.floor(zSegments);

  const planeX1 = planeX + 1;
  const planeZ1 = planeZ + 1;

  const segmentWidth = xSize / planeX;
  const segmentHeight = zSize / planeZ;
  const positions = new Float32Array(planeX1 * planeZ1 * 3);
  const normals = new Float32Array(planeX1 * planeZ1 * 3);
  const uvs = new Float32Array(planeX1 * planeZ1 * 2);

  let offset = 0;
  let offset2 = 0;

  // Create the grid of vertices, normals, and UVs
  for (let iz = 0; iz < planeZ1; iz++) {
    const z = iz * segmentHeight - halfHeight;

    for (let ix = 0; ix < planeX1; ix++) {
      const x = ix * segmentWidth - halfWidth;

      positions[offset] = x + centerX;
      positions[offset + 1] = centerY;
      positions[offset + 2] = -z + centerZ;

      normals[offset + 2] = -1;

      uvs[offset2] = ix / planeX;
      uvs[offset2 + 1] = (planeZ - iz) / planeZ;

      offset += 3;
      offset2 += 2;
    }
  }

  offset = 0;

  // Create the indices for the plane's faces
  const indices = new ((positions.length / 3) > 65535 ? Uint32Array : Uint16Array)(planeX * planeZ * 6);

  for (let iz = 0; iz < planeZ; iz++) {
    for (let ix = 0; ix < planeX; ix++) {
      const a = ix + planeX1 * iz;
      const b = ix + planeX1 * (iz + 1);
      const c = (ix + 1) + planeX1 * (iz + 1);
      const d = (ix + 1) + planeX1 * iz;

      indices[offset] = a;
      indices[offset + 1] = b;
      indices[offset + 2] = d;

      indices[offset + 3] = b;
      indices[offset + 4] = c;
      indices[offset + 5] = d;

      offset += 6;
    }
  }

  const geometryArrays: GeometryArrays = utils.apply(cfg, {
    primitive: "triangles",
    positions,
    normals,
    uv: uvs,
    indices
  });

  return { ok: true, value: geometryArrays };
}