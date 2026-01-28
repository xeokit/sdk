import { GeometryArrays } from "./GeometryArrays";
/**
 * Creates a torus-shaped {@link scene!SceneGeometry | SceneGeometry}.
 *
 * This function generates a torus (doughnut shape) geometry by calculating the positions of vertices based on the specified parameters. It also calculates the normals and UV coordinates for each vertex. The resulting geometry can be used to draw a torus mesh in 3D environments.
 *
 * ## Usage
 *
 * To create a torus geometry, call the function with the desired configuration. For example:
 *
 * ````javascript
 * const torusGeometry = buildTorusGeometry({
 *     radius: 2,
 *     tube: 0.5,
 *     radialSegments: 36,
 *     tubeSegments: 24,
 *     arc: Math.PI * 2,
 *     center: [0, 0, 0]
 * });
 * ````
 *
 * This creates a torus with a radius of 2 units, a tube radius of 0.5 units, 36 radial segments, and 24 tubular segments, with a full circle arc.
 *
 * ## Parameters:
 * @param cfg Configuration object for generating the torus geometry.
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link scene!Scene | Scene}. If omitted, an ID is generated automatically.
 * @param [cfg.center] A 3D point (array of 3 numbers) indicating the center position of the torus. Defaults to `[0, 0, 0]`.
 * @param [cfg.radius=1] The overall radius of the torus. This controls the distance from the center to the tube's center. Default is 1.
 * @param [cfg.tube=0.3] The radius of the tube that makes up the torus. Default is 0.3.
 * @param [cfg.radialSegments=32] The number of radial segments (segments along the circular cross-section). Default is 32.
 * @param [cfg.tubeSegments=24] The number of tubular segments (segments around the tube). Default is 24.
 * @param [cfg.arc=Math.PI*2] The length of the arc in radians, where `Math.PI*2` represents a full circle. Default is a full circle.
 *
 * ## Returns:
 * Returns a {@link scene!SceneGeometry | SceneGeometry} object containing the torus geometry with the necessary positions, indices, and optional normals and UV coordinates for rendering.
 *
 * ## Example:
 * ```javascript
 * const torusGeometry = buildTorusGeometry({
 *     radius: 1.5,
 *     tube: 0.4,
 *     radialSegments: 24,
 *     tubeSegments: 16,
 *     arc: Math.PI * 2,
 *     center: [0, 0, 0]
 * });
 * ```
 *
 * ## Notes:
 * - The geometry is created by iterating over both radial and tube segments, calculating the positions of vertices in 3D space, and connecting them with indices to form triangles.
 * - The arc parameter defines how much of the torus is created. A full circle corresponds to `Math.PI * 2`, and any smaller value creates a partial torus.
 * - The function calculates vertex normals using the difference between each vertex and the center of the torus.
 *
 * @returns {GeometryArrays} The geometry data for the torus, including positions, normals, and indices for rendering.
 */
export declare function buildTorusGeometry(cfg?: {
    tube?: number;
    arc?: number;
    center?: number[];
    radialSegments?: number;
    radius?: number;
    tubeSegments?: number;
}): GeometryArrays;
//# sourceMappingURL=buildTorusGeometry.d.ts.map
