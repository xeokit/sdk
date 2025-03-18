import type { GeometryArrays } from "./GeometryArrays";
import { FloatArrayParam } from "../math";
/**
 * Creates a cylinder-shaped geometry.
 *
 * This function generates the geometry arrays required for a cylinder mesh. The cylinder can be configured in terms of its top and bottom radii, height, radial and height segments, and whether it has caps on its ends.
 * It returns the geometry arrays, including vertex positions, normals, texture coordinates (UVs), and indices for the cylinder's faces.
 *
 * ## Usage
 *
 * ````javascript
 * const cylinderGeometry = buildCylinderGeometry({
 *     center: [0, 0, 0],        // Center of the cylinder
 *     radiusTop: 1,             // Radius of the top of the cylinder
 *     radiusBottom: 1,          // Radius of the bottom of the cylinder
 *     height: 2,                // Height of the cylinder
 *     radialSegments: 32,       // Number of segments around the cylinder
 *     heightSegments: 1,        // Number of segments vertically
 *     openEnded: false          // Whether the cylinder has caps at the ends
 * });
 * ````
 *
 * @param cfg Configuration for the cylinder geometry.
 * @param [cfg.id] Optional ID for the {@link scene!SceneGeometry | SceneGeometry}, unique among all components in the parent {@link scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.center=[0,0,0]] The center position of the cylinder in 3D space, default is `[0, 0, 0]`.
 * @param [cfg.radiusTop=1] The radius of the top of the cylinder. Default is `1`.
 * @param [cfg.radiusBottom=1] The radius of the bottom of the cylinder. Default is `1`.
 * @param [cfg.height=1] The height of the cylinder. Default is `1`.
 * @param [cfg.radialSegments=60] The number of radial (horizontal) segments. Default is `60`.
 * @param [cfg.heightSegments=1] The number of vertical segments. Default is `1`.
 * @param [cfg.openEnded=false] Whether or not the cylinder has solid caps at the top and bottom. Default is `false`.
 * @returns {GeometryArrays} The geometry arrays for the cylinder, including positions, normals, UVs, and indices for the faces.
 *
 * @throws {SDKError} If any of the size parameters (`radiusTop`, `radiusBottom`, `height`, `radialSegments`, `heightSegments`) are negative, the function automatically inverts the values and logs a warning.
 */
export declare function buildCylinderGeometry(cfg?: {
    radiusBottom: number;
    center: FloatArrayParam;
    radialSegments: number;
    heightSegments: number;
    openEnded: boolean;
    radiusTop: number;
    height: number;
}): GeometryArrays;
//# sourceMappingURL=buildCylinderGeometry.d.ts.map