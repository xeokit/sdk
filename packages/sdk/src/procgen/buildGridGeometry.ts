import * as utils from "../utils";
import type {GeometryArrays} from "./GeometryArrays";

/**
 * Creates a grid-shaped {@link scene!SceneGeometry | SceneGeometry}.
 *
 * This function generates the geometry arrays for a grid, which consists of lines along the X and Z axes, creating a grid pattern.
 * The grid can be configured in terms of its size and number of divisions.
 * The function returns the geometry arrays, including vertex positions and indices for drawing the grid.
 *
 * ## Usage
 *
 * ````javascript
 * const gridGeometry = buildGridGeometry({
 *     size: 10,               // Size of the grid along both X and Z axes
 *     divisions: 10           // Number of divisions (grid lines) along X and Z axes
 * });
 * ````
 *
 * @param cfg Configuration for the grid geometry.
 * @param [cfg.id] Optional ID for the {@link scene!SceneGeometry | SceneGeometry}, unique among all components in the parent {@link scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.size=1] The size of the grid along both the X and Z axes. Default is `1`.
 * @param [cfg.divisions=1] The number of divisions (lines) on the X and Z axes. Default is `1`.
 * @returns {GeometryArrays} The geometry arrays for the grid, including positions and indices for the lines.
 *
 * @throws {SDKError} If any of the size or division parameters are negative, the function automatically inverts the values and logs a warning.
 */
export function buildGridGeometry(cfg = {
  size: 1,
  divisions: 1
}): GeometryArrays {

  let size = cfg.size || 1;
  if (size < 0) {
    console.error("negative size not allowed - will invert");
    size *= -1;
  }

  let divisions = cfg.divisions || 1;
  if (divisions < 0) {
    console.error("negative divisions not allowed - will invert");
    divisions *= -1;
  }
  if (divisions < 1) {
    divisions = 1;
  }

  size = size || 10;
  divisions = divisions || 10;

  const step = size / divisions;
  const halfSize = size / 2;

  const positions = [];
  const indices = [];
  let l = 0;

  // Create the grid lines (X and Z axis)
  for (let i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {

    // X-axis lines
    positions.push(-halfSize);
    positions.push(0);
    positions.push(k);

    positions.push(halfSize);
    positions.push(0);
    positions.push(k);

    // Z-axis lines
    positions.push(k);
    positions.push(0);
    positions.push(-halfSize);

    positions.push(k);
    positions.push(0);
    positions.push(halfSize);

    // Add indices for the lines
    indices.push(l++);
    indices.push(l++);
    indices.push(l++);
    indices.push(l++);
  }

  return utils.apply(cfg, {
    primitive: "lines",
    positions: positions,
    indices: indices
  });
}
