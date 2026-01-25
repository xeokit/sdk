import * as utils from "../utils";
import type {GeometryArrays} from "./GeometryArrays";
import {SDKErrorType, type SDKResult} from "../core";

/**
 * Creates a grid-shaped geometry.
 *
 * This function generates the geometry arrays for a grid, which consists of lines along the X and Z axes, creating a grid pattern.
 * The grid can be configured in terms of its size and number of divisions.
 * The function returns the geometry arrays, including vertex positions and indices for drawing the grid.
 *
 * ## Usage
 *
 * ````javascript
 * const gridGeometryResult = buildGridGeometry({
 *     size: 10,               // Size of the grid along both X and Z axes
 *     divisions: 10           // Number of divisions (grid lines) along X and Z axes
 * });
 *
 * if (gridGeometryResult.ok) {
 *    const gridGeometry = gridGeometryResult.value;
 *    // Use gridGeometry here
 * } else {
 *    console.error("Error creating grid geometry:", gridGeometryResult.error);
 * }
 * ````
 *
 * @param cfg Configuration for the grid geometry.
 * @param [cfg.size=1] The size of the grid along both the X and Z axes. Default is `1`.
 * @param [cfg.divisions=1] The number of divisions (lines) on the X and Z axes. Default is `1`.
 * @returns {SDKResult<GeometryArrays>} The geometry arrays for the grid, including positions and indices for the lines, or an error message.
 */
export function buildGridGeometry(cfg : {
  size?: number,
  divisions?: number
}): SDKResult<GeometryArrays> {
  let size = cfg.size || 1;
  if (size < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildGridGeometry] Negative size not allowed."
    };
  }

  let divisions = cfg.divisions || 1;
  if (divisions < 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildGridGeometry] Negative divisions not allowed."
    };
  }
  if (divisions < 1) {
    divisions = 1;
  }

  const step = size / divisions;
  const halfSize = size / 2;

  const positions = [];
  const indices = [];
  let l = 0;

  // Create the grid lines (X and Z axis)
  for (let i = 0, k = -halfSize; i <= divisions; i++, k += step) {
    // X-axis lines
    positions.push(-halfSize, 0, k);
    positions.push(halfSize, 0, k);

    // Z-axis lines
    positions.push(k, 0, -halfSize);
    positions.push(k, 0, halfSize);

    // Add indices for the lines
    indices.push(l++, l++, l++, l++);
  }

  const geometryArrays: GeometryArrays = utils.apply(cfg, {
    primitive: "lines",
    positions: positions,
    indices: indices
  });

  return { ok: true, value: geometryArrays };
}
