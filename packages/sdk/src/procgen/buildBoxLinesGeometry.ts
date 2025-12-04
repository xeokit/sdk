import * as constants from "../constants";
import * as utils from "../utils";
import type {FloatArrayParam} from "../math";
import type {GeometryArrays} from "./GeometryArrays";
import {SDKErrorType, type SDKResult} from "../core";

/**
 * Creates a box-shaped wireframe geometry.
 *
 * This function generates the geometry arrays required for a box mesh in a wireframe style, consisting of line segments.
 * The box's size and position can be customized by adjusting the half-sizes along the X, Y, and Z axes, as well as the center position.
 * It returns the geometry arrays, including vertex positions and indices for the wireframe lines.
 *
 * ## Usage
 *
 * ````javascript
 * const wireframeGeometryResult = buildBoxLinesGeometry({
 *     center: [0, 0, 0],   // Center of the box
 *     xSize: 2,            // Half-size along the X-axis
 *     ySize: 1,            // Half-size along the Y-axis
 *     zSize: 1.5           // Half-size along the Z-axis
 * });
 * ````
 *
 * @param cfg Configurations for the box wireframe geometry.
 * @param [cfg.center=[0,0,0]] The center of the box in 3D space, default is the origin `[0, 0, 0]`.
 * @param [cfg.xSize=1.0] Half-size of the box along the X-axis. The default value is `1.0`.
 * @param [cfg.ySize=1.0] Half-size of the box along the Y-axis. The default value is `1.0`.
 * @param [cfg.zSize=1.0] Half-size of the box along the Z-axis. The default value is `1.0`.
 * @returns {SDKResult<GeometryArrays>} The geometry arrays for a box wireframe, including positions and indices, or an error message.
 */
export function buildBoxLinesGeometry(cfg: {
  center?: FloatArrayParam,
  ySize?: number,
  xSize?: number,
  zSize?: number
} = {
  center: [0, 0, 0],
  xSize: 1,
  ySize: 1,
  zSize: 1
}): SDKResult<GeometryArrays> {

  const center = cfg.center;

  if (center && center.length !== 3) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildBoxLinesGeometry] Center must be a 3D point [x, y, z]."
    };
  }

  const xSize = cfg.xSize || 1;
  if (xSize < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildBoxLinesGeometry] Negative xSize not allowed."
    };
  }

  const ySize = cfg.ySize || 1;
  if (ySize < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildBoxLinesGeometry] Negative ySize not allowed."
    };
  }

  const zSize = cfg.zSize || 1;
  if (zSize < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildBoxLinesGeometry] Negative zSize not allowed."
    };
  }

  const centerX = center ? center[0] : 0;
  const centerY = center ? center[1] : 0;
  const centerZ = center ? center[2] : 0;

  const xmin = -xSize + centerX;
  const ymin = -ySize + centerY;
  const zmin = -zSize + centerZ;
  const xmax = xSize + centerX;
  const ymax = ySize + centerY;
  const zmax = zSize + centerZ;

  const geometryArrays = utils.apply(cfg, {
    primitive: constants.LinesPrimitive,

    // The positions represent the vertices of the box.
    // These are the 8 corner points of the box in 3D space.
    positions: [
      xmin, ymin, zmin,
      xmin, ymin, zmax,
      xmin, ymax, zmin,
      xmin, ymax, zmax,
      xmax, ymin, zmin,
      xmax, ymin, zmax,
      xmax, ymax, zmin,
      xmax, ymax, zmax
    ],

    // Indices define the lines that connect the vertices to form the wireframe.
    indices: [
      0, 1, // line from v0 to v1
      1, 3, // line from v1 to v3
      3, 2, // line from v3 to v2
      2, 0, // line from v2 to v0
      4, 5, // line from v4 to v5
      5, 7, // line from v5 to v7
      7, 6, // line from v7 to v6
      6, 4, // line from v6 to v4
      0, 4, // line from v0 to v4
      1, 5, // line from v1 to v5
      2, 6, // line from v2 to v6
      3, 7 // line from v3 to v7
    ]
  });

  return { ok: true, value: geometryArrays };
}
