import type { GeometryArrays } from "./GeometryArrays";
import { SDKError } from "../core";
/**
 * Creates box-shaped geometry arrays.
 *
 * This function generates the geometry arrays required for a box mesh with configurable sizes along each axis.
 * It provides vertex positions, UV coordinates, and indices to define the box's geometry. You can adjust the box's
 * size along the X, Y, and Z axes and also specify its center position in 3D space.
 *
 * ## Usage
 *
 * ````javascript
 * const boxGeometry = buildBoxGeometry({
 *     center: [0, 0, 0],   // Center of the box
 *     xSize: 2,            // Half-size along the X-axis
 *     ySize: 1,            // Half-size along the Y-axis
 *     zSize: 1.5           // Half-size along the Z-axis
 * });
 * ````
 *
 * @param cfg Configurations for the box geometry.
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.center=[0,0,0]] The center of the box in 3D space, default is the origin `[0, 0, 0]`.
 * @param [cfg.xSize=1.0] Half-size of the box along the X-axis. The default value is `1.0`.
 * @param [cfg.ySize=1.0] Half-size of the box along the Y-axis. The default value is `1.0`.
 * @param [cfg.zSize=1.0] Half-size of the box along the Z-axis. The default value is `1.0`.
 * @returns {GeometryArrays | SDKError} Returns the geometry arrays for the box or an {@link SDKError} if the input sizes are invalid.
 *
 * @throws {SDKError} If any of the sizes (`xSize`, `ySize`, or `zSize`) are negative, an error is thrown.
 */
export declare function buildBoxGeometry(cfg?: {
    center?: number[];
    ySize?: number;
    xSize?: number;
    zSize?: number;
}): GeometryArrays | SDKError;
//# sourceMappingURL=buildBoxGeometry.d.ts.map