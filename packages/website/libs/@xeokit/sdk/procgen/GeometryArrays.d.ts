import { FloatArrayParam, IntArrayParam } from "../math";
/**
 * Geometry data arrays.
 *
 * This type represents the arrays used to define the geometry of a 3D object in the scene, including its primitive type, positions,
 * normals, UV coordinates, and indices. These arrays are typically used by scene rendering engines to define the shape of objects.
 *
 * ## Properties:
 * - `primitive`: The primitive type of the geometry. This value can represent various geometric primitives such as lines, triangles, etc.
 * - `positions`: An array of 3D coordinates (x, y, z) that define the vertices of the geometry.
 * - `normals`: An optional array of normals, which are vectors that are perpendicular to the surface of the geometry. Normals are used for lighting calculations. If not provided,
 * the geometry will not have normals.
 * - `uv`: An optional array of UV coordinates, which map the geometry's vertices to a 2D texture. If not provided, the geometry will not have textures.
 * - `indices`: An optional array of indices that define how the vertices are connected to form the faces of the geometry. If not provided, the geometry
 * may be treated as a point or line.
 *
 * ## Usage:
 * A typical geometry configuration is created by a builder function like `buildGridGeometry` or `buildPlaneGeometry`, which populate the
 * `positions`, `normals`, `uv`, and `indices` arrays. The data is then returned in this `GeometryArrays` format and can be used for rendering in a 3D scene.
 *
 * For example, when building a plane geometry:
 *
 * ````javascript
 * const planeGeometry = buildPlaneGeometry({
 *     xSize: 10,
 *     zSize: 10,
 *     xSegments: 10,
 *     zSegments: 10,
 *     center: [0, 0, 0]
 * });
 * // planeGeometry will be of type GeometryArrays, containing positions, normals, UVs, and indices
 * ````
 *
 * ## Example Object:
 * The following is an example of what a `GeometryArrays` object might look like:
 *
 * ````javascript
 * {
 *     primitive: 20002, // TrianglesPrimitive
 *     positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
 *     normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
 *     uv: [0, 0, 1, 0, 0, 1],
 *     indices: [0, 1, 2]
 * }
 * ````
 *
 * ## Notes:
 * - The `positions` array must always be populated since it defines the geometry's vertices.
 * - Normals, UVs, and indices are optional and only necessary for specific types of geometry (e.g., for texturing or lighting calculations).
 *
 * @typedef {Object} GeometryArrays
 * @property {number} primitive The primitive type, such as {@link constants!LinesPrimitive | LinesPrimitive}, {@link constants!TrianglesPrimitive | TrianglesPrimitive}, or {@link constants!PointsPrimitive | PointsPrimitive}.
 * @property {FloatArrayParam} positions The array of 3D vertex positions in the format [x, y, z].
 * @property {FloatArrayParam} [normals] The optional array of normal vectors in the format [nx, ny, nz].
 * @property {FloatArrayParam} [uv] The optional array of UV texture coordinates in the format [u, v].
 * @property {IntArrayParam} [indices] The optional array of indices used to define the connectivity of the vertices for the geometry's faces.
 */
export type GeometryArrays = {
    primitive: number;
    positions: FloatArrayParam;
    normals?: FloatArrayParam;
    uv?: FloatArrayParam;
    indices?: IntArrayParam;
};
//# sourceMappingURL=GeometryArrays.d.ts.map