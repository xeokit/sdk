/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fsvg)](https://badge.fury.io/js/%40xeokit%2Fmath)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/badge)](https://www.jsdelivr.com/package/npm/@xeokit/math)
 *
 * <img src="http://xeokit.io/img/kdtree.jpeg" />
 *
 * # xeokit Boundaries Math Library
 *
 * ---
 *
 * ### *Tools for 2D and 3D boundary analysis, boundary transformation, and collision detection*
 *
 * ---
 *
 * * Axis-aligned boundaries (AABB2 and AABB3)
 * * Object-aligned boundaries (OBB)
 * * Transformable OOBs
 * * Create boundaries from positions
 * * Find center of positions
 * * FrustumProjection-boundary intersection tests
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/boundaries
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import * as boundaries from "@xeokit/boundaries";
 *
 * //..TODO
 * ````
 *
 * @module @xeokit/boundaries
 */
import type { FloatArrayParam, IntArrayParam } from "@xeokit/math";
/**
 * Returns a new, uninitialized 3D axis-aligned bounding box.
 */
export declare function createAABB3(values?: FloatArrayParam): Float64Array;
/**
 * Returns a new, uninitialized 3D axis-aligned bounding box.
 */
export declare function createAABB3Int16(values?: IntArrayParam): Int16Array;
/**
 * Returns a new, uninitialized 2D axis-aligned bounding box.
 */
export declare function createAABB2(values?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a new, uninitialized 3D oriented bounding box (OBB).
 */
export declare function createOBB3(values?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a new, uninitialized 2D oriented bounding box (OBB).
 */
export declare function createOBB2(values?: FloatArrayParam): FloatArrayParam;
/** Returns a new 3D bounding sphere */
export declare function createSphere3(x: number, y: number, z: number, r: number): FloatArrayParam;
/**
 * Transforms an createOBB3 by a 4x4
 */
export declare function transformOBB3(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam): FloatArrayParam;
/** Returns true if the first AABB2 contains the second AABB2.
 */
export declare function containsAABB2(aabb1: FloatArrayParam, aabb2: FloatArrayParam): boolean;
/** Returns true if the first AABB3 contains the second AABB3.
 */
export declare function containsAABB3(aabb1: FloatArrayParam, aabb2: FloatArrayParam): boolean;
/**
 * Gets the diagonal size of an createAABB3 given as minima and maxima.
 */
export declare const getAABB3Diag: Function;
/**
 * Get a diagonal boundary size that is symmetrical about the given point.
 */
export declare const getAABB3DiagPoint: (aabb: FloatArrayParam, p: FloatArrayParam) => number;
/**
 * Gets the area of an AABB.
 */
export declare function getAABB3Area(aabb: FloatArrayParam): number;
/**
 * Gets the center of an AABB.
 */
export declare function getAABB3Center(aabb: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Gets the center of a 2D AABB.
 */
export declare function getAABB2Center(aabb: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Collapses a 3D axis-aligned boundary, ready to expand to fit 3D points.
 * Creates new AABB if none supplied.
 */
export declare function collapseAABB3(aabb?: FloatArrayParam): FloatArrayParam;
/**
 * Collapses a 3D axis-aligned boundary, ready to expand to fit 3D points.
 * Creates new AABB if none supplied.
 */
export declare function collapseAABB3Int16(aabb?: IntArrayParam): IntArrayParam;
/**
 * Converts an axis-aligned 3D boundary into an oriented boundary consisting of
 * an array of eight 3D positions, one for each corner of the boundary.
 *
 * @private
 */
export declare function AABB3ToOBB3(aabb?: FloatArrayParam, obb?: FloatArrayParam): FloatArrayParam;
/**
 * Expands the first axis-aligned 3D boundary to enclose the second, if required.
 */
export declare function expandAABB3(aabb1: FloatArrayParam, aabb2: FloatArrayParam): FloatArrayParam;
/**
 * Expands the first axis-aligned 2D boundary to enclose the second, if required.
 */
export declare function expandAABB2(aabb1: FloatArrayParam, aabb2: FloatArrayParam): FloatArrayParam;
/**
 * Expands an axis-aligned 3D boundary to enclose the given point, if needed.
 */
export declare function expandAABB3Point3(aabb: FloatArrayParam, p: FloatArrayParam): FloatArrayParam;
/**
 * Expands an axis-aligned 2D boundary to enclose the given point, if needed.
 */
export declare function expandAABB2Point2(aabb: FloatArrayParam, p: FloatArrayParam): FloatArrayParam;
/**
 * Expands an axis-aligned 3D boundary to enclose the given points, if needed.
 */
export declare function expandAABB3Points3(aabb: FloatArrayParam, positions: FloatArrayParam): FloatArrayParam;
/**
 * Converts an axis-aligned 3D boundary into an oriented boundary consisting of
 * an array of eight 3D positions, one for each corner of the boundary.
 */
export declare function ABB3ToOBB3(aabb: FloatArrayParam, obb?: FloatArrayParam): FloatArrayParam;
/**
 * Finds the minimum axis-aligned 3D boundary enclosing the homogeneous 3D points (x,y,z,w) given in a flattened array.
 */
export declare const positions3ToAABB3: (positions: FloatArrayParam, aabb: FloatArrayParam, positionsDecompressMatrix: FloatArrayParam) => FloatArrayParam;
/**
 * Finds the minimum axis-aligned 3D boundary enclosing the homogeneous 3D points (x,y,z,w) given in a flattened array.
 */
export declare function OBB3ToAABB3(obb: FloatArrayParam, aabb?: FloatArrayParam): FloatArrayParam;
/**
 * Finds the minimum axis-aligned 3D boundary enclosing the given 3D points.
 */
export declare function points3ToAABB3(points: number[][], aabb?: FloatArrayParam): FloatArrayParam;
/**
 * Gets the 3D center of the given flat array of 3D positions.
 */
export declare function getPositions3Center(positions: FloatArrayParam, center?: FloatArrayParam): FloatArrayParam;
/**
 * A plane within a {@link Frustum3}.
 */
export declare class FrustumPlane3 {
    testVertex: FloatArrayParam;
    offset: number;
    normal: FloatArrayParam;
    /**
     * Creates a new frustum plane.
     */
    constructor();
    /**
     * Sets the position and direction of the frustum plane.
     * @param nx
     * @param ny
     * @param nz
     * @param offset
     */
    set(nx: number, ny: number, nz: number, offset: number): void;
}
/**
 * Intersection state in which first boundary is completely inside the second.
 */
export declare const INSIDE: number;
/**
 * Intersection state in which two boundaries partially intersect.
 */
export declare const INTERSECT: number;
/**
 * Intersection state in which two boundaries do not intersect.
 */
export declare const OUTSIDE: number;
/**
 * A 3D frustum defined as six planes.
 */
export declare class Frustum3 {
    /**
     * The six planes that comprise the frustum boundary.
     */
    planes: FrustumPlane3[];
    /**
     * Creates a new FrustumProjection
     */
    constructor();
}
/**
 * Sets the extents of a frustum to the World-space volume defined by view and projection matrices.
 * Creates the frustum first if not given.
 */
export declare function setFrustum3(viewMat: FloatArrayParam, projMat: FloatArrayParam, frustum?: Frustum3): Frustum3;
/**
 * Tests for intersection between a frustum and an axis-aligned 3D boundary.
 * @param frustum
 * @param aabb
 */
export declare function intersectFrustum3AABB3(frustum: Frustum3, aabb: FloatArrayParam): number;
/**
 * Tests for intersection between two axis-aligned 3D boundaries.
 * @param aabb1
 * @param aabb2
 */
export declare function intersectAABB3s(aabb1: FloatArrayParam, aabb2: FloatArrayParam): number;
/**
 * Tests if the given {@link @math/boundaries!Frustum3 | Frustum3} intersects the given {@link @xeokit/core/constants!TrianglesPrimitive | TrianglesPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param positions
 * @param indices
 */
export declare function intersectFrustum3Triangles3(frustum: Frustum3, positions: FloatArrayParam, indices: IntArrayParam): boolean;
/**
 * Tests if the given {@link @math/boundaries!Frustum3 | Frustum3} intersects the given triangle primitive.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param a
 * @param b
 * @param c
 */
export declare function intersectFrustum3Triangle3(frustum: Frustum3, a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam): boolean;
/**
 * Tests if the given {@link @math/boundaries!Frustum3 | Frustum3} intersects the given {@link @xeokit/core/constants!LinesPrimitive | LinesPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param positions
 * @param indices
 */
export declare function intersectFrustum3Lines3(frustum: Frustum3, positions: FloatArrayParam, indices: IntArrayParam): boolean;
/**
 * Tests if the given {@link @math/boundaries!Frustum3 | Frustum3} intersects the given {@link @xeokit/core/constants!PointsPrimitive | PointsPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param positions
 */
export declare function intersectFrustum3Positions3(frustum: Frustum3, positions: FloatArrayParam): boolean;
/**
 * Tests if the given {@link @math/boundaries!Frustum3 | Frustum3} intersects the given position.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param position
 */
export declare function intersectFrustum3Point3(frustum: Frustum3, position: FloatArrayParam): boolean;
/**
 * Tests if the given AABB intersects the given {@link @xeokit/core/constants!TrianglesPrimitive | TrianglesPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param aabb
 * @param positions
 * @param indices
 */
export declare function intersectAABB3Triangles3(aabb: FloatArrayParam, positions: FloatArrayParam, indices: IntArrayParam): boolean;
/**
 * Tests if the given AABB intersects the given {@link @xeokit/core/constants!LinesPrimitive | LinesPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param aabb
 * @param positions
 * @param indices
 */
export declare function intersectAABB3Lines3(aabb: FloatArrayParam, positions: FloatArrayParam, indices: IntArrayParam): boolean;
/**
 * Tests if the given AABB intersects the given {@link @xeokit/core/constants!PointsPrimitive | PointsPrimitive} vertex positions.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param aabb
 * @param positions
 */
export declare function intersectAABB3Positions3(aabb: FloatArrayParam, positions: FloatArrayParam): boolean;
/**
 * Tets if the given 3D AABB contains the given 3D position.
 * @param aabb
 * @param p
 */
export declare function containsAABB3Point3(aabb: FloatArrayParam, p: FloatArrayParam): boolean;
/**
 * Tets if the given 2D AABB contains the given 2D position.
 * @param aabb
 * @param p
 */
export declare function containsAABB2Point2(aabb: FloatArrayParam, p: FloatArrayParam): boolean;
