/**
 * <img src="http://xeokit.io/img/kdtree.jpeg" />
 *
 * # xeokit Boundaries Math Library
 *
 * ---
 *
 * **Tools for 2D and 3D boundary analysis, transformations, and collision detection.**
 *
 * ---
 *
 * **Features:**
 * - Axis-Aligned Bounding Boxes (AABB2 & AABB3)
 * - Oriented Bounding Boxes (OBB)
 * - Transformable OBBs
 * - Boundary creation from positions
 * - Center point calculations
 * - Frustum projection and boundary intersection tests
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage Example
 *
 * ```javascript
 * import { createAABB3 } from "@xeokit/sdk/boundaries";
 *
 * const aabb = createAABB3([-100, -100, -100, 100, 100, 100]);
 * ```
 *
 * @module boundaries
 */
import { FloatArrayParam, IntArrayParam } from "../math";
/**
 * Creates a new 3D axis-aligned bounding box (AABB3).
 *
 * @param values - Optional initial values for the AABB3.
 * @returns A new Float64Array representing the AABB3.
 */
export declare function createAABB3(values?: FloatArrayParam): Float64Array<any>;
/**
 * Creates a new 3D axis-aligned bounding box (AABB3) with Int16 values.
 *
 * @param values - Optional initial values for the AABB3.
 * @returns A new Int16Array representing the AABB3.
 */
export declare function createAABB3Int16(values?: IntArrayParam): Int16Array<any>;
/**
 * Creates a new 2D axis-aligned bounding box (AABB2).
 *
 * @param values - Optional initial values for the AABB2.
 * @returns A new FloatArrayParam representing the AABB2.
 */
export declare function createAABB2(values?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a new 3D oriented bounding box (OBB3).
 *
 * @param values - Optional initial values for the OBB3.
 * @returns A new FloatArrayParam representing the OBB3.
 */
export declare function createOBB3(values?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a new 2D oriented bounding box (OBB2).
 *
 * @param values - Optional initial values for the OBB2.
 * @returns A new FloatArrayParam representing the OBB2.
 */
export declare function createOBB2(values?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a new 3D bounding sphere.
 *
 * @param x - X coordinate of the sphere center.
 * @param y - Y coordinate of the sphere center.
 * @param z - Z coordinate of the sphere center.
 * @param r - Radius of the sphere.
 * @returns A FloatArrayParam representing the sphere, format `[x, y, z, r]`.
 */
export declare function createSphere3(x: number, y: number, z: number, r: number): FloatArrayParam;
/**
 * Transforms a 3D oriented bounding box (OBB3) using a 4x4 transformation matrix.
 *
 * @param m - The 4x4 transformation matrix.
 * @param p - The OBB3 to transform.
 * @param p2 - Optional destination array for transformed OBB3. Defaults to modifying `p`.
 * @returns The transformed OBB3.
 */
export declare function transformOBB3(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam): FloatArrayParam;
/**
 * Checks if one AABB2 fully contains another.
 *
 * @param aabb1 - The first AABB2.
 * @param aabb2 - The second AABB2.
 * @returns `true` if `aabb1` contains `aabb2`, otherwise `false`.
 */
export declare function containsAABB2(aabb1: FloatArrayParam, aabb2: FloatArrayParam): boolean;
/**
 * Checks if one AABB3 fully contains another.
 *
 * @param aabb1 - The first AABB3.
 * @param aabb2 - The second AABB3.
 * @returns `true` if `aabb1` contains `aabb2`, otherwise `false`.
 */
export declare function containsAABB3(aabb1: FloatArrayParam, aabb2: FloatArrayParam): boolean;
/**
 * Computes the diagonal length of a 3D axis-aligned bounding box (AABB3).
 *
 * @param aabb - The AABB3.
 * @returns The diagonal length.
 */
export declare function getAABB3Diag(aabb: FloatArrayParam): number;
/**
 * Computes the center of a 3D axis-aligned bounding box (AABB3).
 *
 * @param aabb - The AABB3.
 * @param dest - Optional destination array for the center coordinates.
 * @returns The center coordinates.
 */
export declare function getAABB3Center(aabb: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Get a diagonal boundary size that is symmetrical about the given point.
 */
export declare const getAABB3DiagPoint: (aabb: FloatArrayParam, p: FloatArrayParam) => number;
/**
 * Gets the area of an AABB.
 */
export declare function getAABB3Area(aabb: FloatArrayParam): number;
/**
 * Collapses an AABB3, resetting it to its maximum bounds.
 *
 * @param aabb - Optional AABB3 to collapse. If omitted, a new one is created.
 * @returns The collapsed AABB3.
 */
export declare function collapseAABB3(aabb?: FloatArrayParam): FloatArrayParam;
/**
 * Converts an axis-aligned bounding box (AABB) into an oriented bounding box (OBB)
 * consisting of eight 3D corner positions.
 *
 * @param aabb - The input AABB `[minX, minY, minZ, maxX, maxY, maxZ]`.
 * @param obb - The output OBB array (defaults to a new OBB).
 * @returns The computed OBB.
 */
export declare function AABB3ToOBB3(aabb?: FloatArrayParam, obb?: FloatArrayParam): FloatArrayParam;
/**
 * Expands the first AABB to enclose the second AABB if required.
 *
 * @param aabb1 - The target AABB to expand.
 * @param aabb2 - The source AABB to enclose.
 * @returns The expanded AABB1.
 */
export declare function expandAABB3(aabb1: FloatArrayParam, aabb2: FloatArrayParam): FloatArrayParam;
/**
 * Expands the first 2D AABB to enclose the second AABB if required.
 *
 * @param aabb1 - The target AABB to expand.
 * @param aabb2 - The source AABB to enclose.
 * @returns The expanded AABB1.
 */
export declare function expandAABB2(aabb1: FloatArrayParam, aabb2: FloatArrayParam): FloatArrayParam;
/**
 * Expands an AABB to enclose a given 3D point if required.
 *
 * @param aabb - The AABB to expand.
 * @param p - The 3D point `[x, y, z]`.
 * @returns The expanded AABB.
 */
export declare function expandAABB3Point3(aabb: FloatArrayParam, p: FloatArrayParam): FloatArrayParam;
/**
 * Expands an AABB to enclose a given 2D point if required.
 *
 * @param aabb - The AABB to expand.
 * @param p - The 2D point `[x, y]`.
 * @returns The expanded AABB.
 */
export declare function expandAABB2Point2(aabb: FloatArrayParam, p: FloatArrayParam): FloatArrayParam;
/**
 * Expands an AABB to enclose multiple 3D points.
 *
 * @param aabb - The AABB to expand.
 * @param positions - A flattened array of 3D points `[x0, y0, z0, x1, y1, z1, ...]`.
 * @returns The expanded AABB.
 */
export declare function expandAABB3Points3(aabb: FloatArrayParam, positions: FloatArrayParam): FloatArrayParam;
/**
 * Computes the axis-aligned bounding box (AABB) enclosing a set of 3D positions stored as a flattened array.
 * If the positions are compressed, it applies a decompression matrix before computing the bounds.
 *
 * @param positions - A flattened array of 3D points `[x0, y0, z0, x1, y1, z1, ...]`.
 * @param aabb - The output AABB array `[minX, minY, minZ, maxX, maxY, maxZ]`. If not provided, a new AABB is created.
 * @param positionsDecompressMatrix - Optional 4x4 matrix to decompress positions.
 * @returns The computed AABB.
 */
export declare const positions3ToAABB3: (positions: FloatArrayParam, aabb?: FloatArrayParam, positionsDecompressMatrix?: FloatArrayParam) => FloatArrayParam;
/**
 * Computes the axis-aligned bounding box (AABB) enclosing an oriented bounding box (OBB).
 *
 * @param obb - A flattened array of OBB corner points `[x0, y0, z0, w0, x1, y1, z1, w1, ...]`.
 * @param aabb - The output AABB `[minX, minY, minZ, maxX, maxY, maxZ]`. Defaults to a new AABB.
 * @returns The computed AABB.
 */
export declare function OBB3ToAABB3(obb: FloatArrayParam, aabb?: FloatArrayParam): FloatArrayParam;
/**
 * Computes the axis-aligned bounding box (AABB) enclosing a set of 3D points.
 *
 * @param points - An array of 3D points `[[x0, y0, z0], [x1, y1, z1], ...]`.
 * @param aabb - The output AABB `[minX, minY, minZ, maxX, maxY, maxZ]`. Defaults to a new AABB.
 * @returns The computed AABB.
 */
export declare function points3ToAABB3(points: number[][], aabb?: FloatArrayParam): FloatArrayParam;
/**
 * Computes the center of a set of 3D positions stored in a flattened array.
 *
 * @param positions - A flattened array of 3D points `[x0, y0, z0, x1, y1, z1, ...]`.
 * @param center - The output center point `[x, y, z]`. Defaults to a new vector.
 * @returns The computed center `[x, y, z]`.
 */
export declare function getPositions3Center(positions: FloatArrayParam, center?: FloatArrayParam): FloatArrayParam;
/**
 * A plane within a {@link Frustum3}.
 */
export declare class FrustumPlane3 {
    /**
     * A vertex used to test intersections with this plane.
     */
    testVertex: FloatArrayParam;
    /**
     * The distance of the plane from the origin along its normal.
     */
    offset: number;
    /**
     * The normal vector of the plane.
     */
    normal: FloatArrayParam;
    /**
     * Creates a new frustum plane.
     */
    constructor();
    /**
     * Sets the position and direction of the frustum plane.
     *
     * @param nx - X component of the normal vector.
     * @param ny - Y component of the normal vector.
     * @param nz - Z component of the normal vector.
     * @param offset - Distance of the plane from the origin.
     */
    set(nx: number, ny: number, nz: number, offset: number): void;
}
/**
 * Intersection state indicating that the first boundary is completely inside the second.
 */
export declare const INSIDE: number;
/**
 * Intersection state indicating that two boundaries partially intersect.
 */
export declare const INTERSECT: number;
/**
 * Intersection state indicating that two boundaries do not intersect.
 */
export declare const OUTSIDE: number;
/**
 * A 3D frustum defined by six planes.
 */
export declare class Frustum3 {
    /**
     * The six planes that define the frustum boundary.
     */
    planes: FrustumPlane3[];
    /**
     * Creates a new 3D frustum.
     */
    constructor();
}
/**
 * Sets the extents of a frustum to the world-space volume defined by view and projection matrices.
 * Creates the frustum if it is not provided.
 *
 * @param viewMat - The 4x4 view matrix.
 * @param projMat - The 4x4 projection matrix.
 * @param frustum - Optional frustum instance to modify. If not provided, a new frustum is created.
 * @returns The updated or newly created frustum.
 */
export declare function setFrustum3(viewMat: FloatArrayParam, projMat: FloatArrayParam, frustum?: Frustum3): Frustum3;
/**
 * Tests for intersection between a frustum and an axis-aligned 3D boundary.
 *
 * @param frustum - The frustum to test.
 * @param aabb - The axis-aligned bounding box (AABB) represented as an array `[minX, minY, minZ, maxX, maxY, maxZ]`.
 * @returns The intersection state: `INSIDE`, `INTERSECT`, or `OUTSIDE`.
 */
export declare function intersectFrustum3AABB3(frustum: Frustum3, aabb: FloatArrayParam): number;
/**
 * Tests for intersection between two axis-aligned 3D boundaries.
 *
 * @param {FloatArrayParam} aabb1 - The first axis-aligned bounding box, represented as an array of six numbers [minX, minY, minZ, maxX, maxY, maxZ].
 * @param {FloatArrayParam} aabb2 - The second axis-aligned bounding box, represented as an array of six numbers.
 * @returns {number} - Returns an intersection code indicating the result of the test.
 */
export declare function intersectAABB3s(aabb1: FloatArrayParam, aabb2: FloatArrayParam): number;
/**
 * Tests if a frustum intersects a triangles primitive geometry.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} positions - The vertex positions of the geometry.
 * @param {IntArrayParam} indices - The indices defining the triangle faces.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export declare function intersectFrustum3Triangles3(frustum: any, positions: FloatArrayParam, indices: IntArrayParam): boolean;
/**
 * Tests if a frustum intersects a single triangle.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} a - The first vertex of the triangle.
 * @param {FloatArrayParam} b - The second vertex of the triangle.
 * @param {FloatArrayParam} c - The third vertex of the triangle.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export declare function intersectFrustum3Triangle3(frustum: any, a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam): boolean;
/**
 * Tests if a frustum intersects a lines primitive geometry.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} positions - The vertex positions of the lines.
 * @param {IntArrayParam} indices - The indices defining the line segments.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export declare function intersectFrustum3Lines3(frustum: any, positions: any, indices: any): boolean;
/**
 * Tests if a frustum intersects a points primitive geometry.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} positions - The vertex positions of the points.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export declare function intersectFrustum3Positions3(frustum: Frustum3, positions: FloatArrayParam): boolean;
/**
 * Tests if a frustum intersects a single point.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} position - The position of the point.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export declare function intersectFrustum3Point3(frustum: Frustum3, position: FloatArrayParam): boolean;
/**
 * Tests if an AABB intersects a triangles primitive geometry.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} positions - The vertex positions of the geometry.
 * @param {IntArrayParam} indices - The indices defining the triangle faces.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export declare function intersectAABB3Triangles3(aabb: FloatArrayParam, positions: FloatArrayParam, indices: IntArrayParam): boolean;
/**
 * Tests if an AABB intersects a lines primitive geometry.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} positions - The vertex positions of the lines.
 * @param {IntArrayParam} indices - The indices defining the line segments.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export declare function intersectAABB3Lines3(aabb: FloatArrayParam, positions: FloatArrayParam, indices: IntArrayParam): boolean;
/**
 * Tests if an AABB intersects points within the given positions array.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} positions - The vertex positions of the points.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export declare function intersectAABB3Positions3(aabb: FloatArrayParam, positions: FloatArrayParam): boolean;
/**
 * Tests if a 3D AABB contains a 3D point.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} p - The position of the point.
 * @returns {boolean} - True if the point is inside the AABB, false otherwise.
 */
export declare function containsAABB3Point3(aabb: FloatArrayParam, p: FloatArrayParam): boolean;
/**
 * Tests if a 2D AABB contains a 2D point.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} p - The position of the point.
 * @returns {boolean} - True if the point is inside the AABB, false otherwise.
 */
export declare function containsAABB2Point2(aabb: FloatArrayParam, p: FloatArrayParam): boolean;
//# sourceMappingURL=index.d.ts.map