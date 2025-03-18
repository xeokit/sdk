import type { GeometryArrays } from "./GeometryArrays";
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
export declare function buildGridGeometry(cfg?: {
    size: number;
    divisions: number;
}): GeometryArrays;
//# sourceMappingURL=buildGridGeometry.d.ts.map