import { FloatArrayParam } from "./math";
/**
 * Returns a new, uninitialized 3D axis-aligned bounding box.
 */
export declare function createAABB3(values?: FloatArrayParam): Float64Array;
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
 * Transforms an createOBB3 by a 4x4 matrix.
 */
export declare function transformOBB3(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam): FloatArrayParam;
/** Returns true if the first AABB contains the second AABB.
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
 * Expands an axis-aligned 3D boundary to enclose the given point, if needed.
 */
export declare function expandAABB3Point3(aabb: FloatArrayParam, p: FloatArrayParam): FloatArrayParam;
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
export declare function getPositionsCenter(positions: FloatArrayParam, center?: FloatArrayParam): FloatArrayParam;
