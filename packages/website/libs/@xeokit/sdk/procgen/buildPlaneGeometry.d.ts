import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates a plane-shaped {@link scene!SceneGeometry | SceneGeometry}.
 *
 * This function generates a plane geometry with configurable dimensions and segments. The plane is created by defining a grid of vertices
 * with associated normals and UV coordinates, and creating the indices to connect them in a grid-like fashion. The plane is then returned
 * as a geometry that can be used to create a mesh in the scene.
 *
 * ## Usage
 *
 * Creating a {@link scene!SceneMesh | SceneMesh} with a plane-shaped {@link scene!SceneGeometry | SceneGeometry}:
 *
 * ````javascript
 * const planeGeometry = buildPlaneGeometry({
 *     xSize: 10,              // Width of the plane
 *     zSize: 10,              // Depth of the plane
 *     xSegments: 10,          // Number of segments along the X-axis
 *     zSegments: 10,          // Number of segments along the Z-axis
 *     center: [0, 0, 0]       // Center position of the plane in 3D space
 * });
 * ````
 *
 * @param cfg Configuration for the plane geometry.
 * @param [cfg.center=[0, 0, 0]] The 3D point indicating the center of the plane.
 * @param [cfg.id] Optional ID for the {@link scene!SceneGeometry | SceneGeometry}, unique among all components in the parent {@link scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.xSize=1] The width of the plane along the X-axis. Default is `1`.
 * @param [cfg.zSize=1] The depth of the plane along the Z-axis. Default is `1`.
 * @param [cfg.xSegments=1] The number of segments along the X-axis. Default is `1`.
 * @param [cfg.zSegments=1] The number of segments along the Z-axis. Default is `1`.
 * @returns {GeometryArrays} The geometry arrays for the plane, including positions, normals, UVs, and indices.
 *
 * @throws {SDKError} If any of the size or segment parameters are negative, the function automatically inverts the values and logs a warning.
 */
export declare function buildPlaneGeometry(cfg?: {
    xSize: number;
    zSize: number;
    xSegments: number;
    zSegments: number;
    center: number[];
}): GeometryArrays;
//# sourceMappingURL=buildPlaneGeometry.d.ts.map