import type { FloatArrayParam } from "./math";
/**
 * A plane within a {@link Frustum}.
 */
declare class FrustumPlane {
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
 * A frustum defined as six planes.
 */
declare class Frustum {
    /**
     * The six planes that comprise the frustum boundary.
     */
    planes: FrustumPlane[];
    /**
     *
     */
    static INSIDE: number;
    static INTERSECT: number;
    static OUTSIDE: number;
    /**
     * Creates a new Frustum
     */
    constructor();
}
/**
 * Sets the extents of a frustum to the World-space volume defined by view and projection matrices.
 * @param frustum
 * @param viewMat
 * @param projMat
 */
export declare function setFrustum(frustum: Frustum, viewMat: FloatArrayParam, projMat: FloatArrayParam): void;
/**
 * Tests for intersection between a frustum and an axis-aligned 3D boundary.
 * @param frustum
 * @param aabb
 */
export declare function frustumIntersectsAABB3(frustum: Frustum, aabb: FloatArrayParam): number;
export {};
