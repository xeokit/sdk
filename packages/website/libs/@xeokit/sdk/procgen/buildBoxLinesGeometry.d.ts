import type { GeometryArrays } from "./GeometryArrays";
import { FloatArrayParam } from "../math";
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
 * const wireframeGeometry = buildBoxLinesGeometry({
 *     center: [0, 0, 0],   // Center of the box
 *     xSize: 2,            // Half-size along the X-axis
 *     ySize: 1,            // Half-size along the Y-axis
 *     zSize: 1.5           // Half-size along the Z-axis
 * });
 * ````
 *
 * @param cfg Configurations for the box wireframe geometry.
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.center=[0,0,0]] The center of the box in 3D space, default is the origin `[0, 0, 0]`.
 * @param [cfg.xSize=1.0] Half-size of the box along the X-axis. The default value is `1.0`.
 * @param [cfg.ySize=1.0] Half-size of the box along the Y-axis. The default value is `1.0`.
 * @param [cfg.zSize=1.0] Half-size of the box along the Z-axis. The default value is `1.0`.
 * @returns {GeometryArrays} The geometry arrays for a box wireframe, including positions and indices for the wireframe.
 *
 * @throws {SDKError} If any of the sizes (`xSize`, `ySize`, or `zSize`) are negative, the function automatically inverts the sizes and logs a warning.
 */
export declare function buildBoxLinesGeometry(cfg?: {
    center?: FloatArrayParam;
    ySize?: number;
    xSize?: number;
    zSize?: number;
}): GeometryArrays;
//# sourceMappingURL=buildBoxLinesGeometry.d.ts.map