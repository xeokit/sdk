import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates a sphere-shaped {@link scene!SceneGeometry | SceneGeometry}.
 *
 * This function generates a sphere geometry by calculating the positions of vertices based on the specified parameters. The sphere is defined by its radius and the number of latitudinal and longitudinal segments. The resulting geometry includes the positions, normals, UVs, and indices necessary to draw the sphere.
 *
 * ## Usage
 *
 * To create a sphere geometry, call the function with the desired configuration. For example:
 *
 * ```javascript
 * const sphereGeometry = buildSphereGeometry({
 *     radius: 2,
 *     heightSegments: 24,
 *     widthSegments: 18,
 *     center: [0, 0, 0]
 * });
 * ```
 *
 * This creates a sphere with a radius of 2 units, 24 latitudinal segments, 18 longitudinal segments, centered at `[0, 0, 0]`.
 *
 * ## Parameters:
 * @param cfg Configuration object for generating the sphere geometry.
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link scene!Scene | Scene}. If omitted, an ID is generated automatically.
 * @param [cfg.center] A 3D point (array of 3 numbers) indicating the center position of the sphere. Defaults to `[0, 0, 0]`.
 * @param [cfg.radius=1] The radius of the sphere. Default is 1.
 * @param [cfg.heightSegments=24] The number of latitudinal segments (bands from top to bottom). Default is 24.
 * @param [cfg.widthSegments=18] The number of longitudinal segments (bands around the sphere). Default is 18.
 *
 * ## Returns:
 * Returns a {@link scene!SceneGeometry | SceneGeometry} object containing the sphere geometry with the necessary positions, normals, UV coordinates, and indices for rendering.
 *
 * ## Example:
 * ```javascript
 * const sphereGeometry = buildSphereGeometry({
 *     radius: 2,
 *     heightSegments: 24,
 *     widthSegments: 18,
 *     center: [0, 0, 0]
 * });
 * ````
 *
 * ## Notes:
 * - The sphere is created by iterating over latitudinal and longitudinal segments to calculate the positions of vertices.
 * - Normals are calculated as the unit vectors pointing outward from the center of the sphere.
 * - UV coordinates are mapped to the sphere based on the latitude and longitude of each vertex.
 * - Indices are generated to create triangles from the vertices.
 *
 * @returns {GeometryArrays} The geometry data for the sphere, including positions, normals, UV coordinates, and indices.
 */
export declare function buildSphereGeometry(cfg?: {
    center: number[];
    heightSegments: number;
    radius: number;
    widthSegments: number;
}): GeometryArrays;
//# sourceMappingURL=buildSphereGeometry.d.ts.map
