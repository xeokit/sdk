/**
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
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import * as boundaries from "@xeokit/sdk/boundaries";
 *
 * //..TODO
 * ````
 *
 * @module boundaries
 */
import { MAX_DOUBLE, MIN_DOUBLE, newFloatArray } from "../math";
import { createMat4, createVec2, createVec3, lenVec3, mulMat4, subVec3 } from "../matrix";
import { decompressPoint3WithMat4 } from "../compression";
const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempMat4a = createMat4();
/**
 * Returns a new, uninitialized 3D axis-aligned bounding box.
 */
export function createAABB3(values) {
    // @ts-ignore
    return new Float64Array(values || 6);
}
/**
 * Returns a new, uninitialized 3D axis-aligned bounding box.
 */
export function createAABB3Int16(values) {
    // @ts-ignore
    return new Int16Array(values || 6);
}
/**
 * Returns a new, uninitialized 2D axis-aligned bounding box.
 */
export function createAABB2(values) {
    // @ts-ignore
    return newFloatArray(values || 4);
}
/**
 * Returns a new, uninitialized 3D oriented bounding box (OBB).
 */
export function createOBB3(values) {
    // @ts-ignore
    return newFloatArray(values || 32);
}
/**
 * Returns a new, uninitialized 2D oriented bounding box (OBB).
 */
export function createOBB2(values) {
    // @ts-ignore
    return newFloatArray(values || 16);
}
/** Returns a new 3D bounding sphere */
export function createSphere3(x, y, z, r) {
    return newFloatArray([x, y, z, r]);
}
/**
 * Transforms an createOBB3 by a 4x4
 */
export function transformOBB3(m, p, p2 = p) {
    let i;
    const len = p.length;
    let x;
    let y;
    let z;
    const m0 = m[0];
    const m1 = m[1];
    const m2 = m[2];
    const m3 = m[3];
    const m4 = m[4];
    const m5 = m[5];
    const m6 = m[6];
    const m7 = m[7];
    const m8 = m[8];
    const m9 = m[9];
    const m10 = m[10];
    const m11 = m[11];
    const m12 = m[12];
    const m13 = m[13];
    const m14 = m[14];
    const m15 = m[15];
    for (i = 0; i < len; i += 4) {
        x = p[i + 0];
        y = p[i + 1];
        z = p[i + 2];
        p2[i + 0] = m0 * x + m4 * y + m8 * z + m12;
        p2[i + 1] = m1 * x + m5 * y + m9 * z + m13;
        p2[i + 2] = m2 * x + m6 * y + m10 * z + m14;
        p2[i + 3] = m3 * x + m7 * y + m11 * z + m15;
    }
    return p2;
}
/** Returns true if the first AABB2 contains the second AABB2.
 */
export function containsAABB2(aabb1, aabb2) {
    return aabb1[0] <= aabb2[0] &&
        aabb2[3] <= aabb1[3] &&
        aabb1[1] <= aabb2[1] &&
        aabb1[2] <= aabb2[2];
}
/** Returns true if the first AABB3 contains the second AABB3.
 */
export function containsAABB3(aabb1, aabb2) {
    const result = aabb1[0] <= aabb2[0] &&
        aabb2[3] <= aabb1[3] &&
        aabb1[1] <= aabb2[1] &&
        aabb2[4] <= aabb1[4] &&
        aabb1[2] <= aabb2[2] &&
        aabb2[5] <= aabb1[5];
    return result;
}
/**
 * Gets the diagonal size of an createAABB3 given as minima and maxima.
 */
export const getAABB3Diag = (() => {
    const min = newFloatArray(3);
    const max = newFloatArray(3);
    const tempVec3 = newFloatArray(3);
    return (aabb) => {
        min[0] = aabb[0];
        min[1] = aabb[1];
        min[2] = aabb[2];
        max[0] = aabb[3];
        max[1] = aabb[4];
        max[2] = aabb[5];
        subVec3(max, min, tempVec3);
        return Math.abs(lenVec3(tempVec3));
    };
})();
/**
 * Get a diagonal boundary size that is symmetrical about the given point.
 */
export const getAABB3DiagPoint = (() => {
    const min = newFloatArray(3);
    const max = newFloatArray(3);
    const tempVec3 = newFloatArray(3);
    return (aabb, p) => {
        min[0] = aabb[0];
        min[1] = aabb[1];
        min[2] = aabb[2];
        max[0] = aabb[3];
        max[1] = aabb[4];
        max[2] = aabb[5];
        const diagVec = subVec3(max, min, tempVec3);
        const xneg = p[0] - aabb[0];
        const xpos = aabb[3] - p[0];
        const yneg = p[1] - aabb[1];
        const ypos = aabb[4] - p[1];
        const zneg = p[2] - aabb[2];
        const zpos = aabb[5] - p[2];
        diagVec[0] += xneg > xpos ? xneg : xpos;
        diagVec[1] += yneg > ypos ? yneg : ypos;
        diagVec[2] += zneg > zpos ? zneg : zpos;
        return Math.abs(lenVec3(diagVec));
    };
})();
/**
 * Gets the area of an AABB.
 */
export function getAABB3Area(aabb) {
    const width = aabb[3] - aabb[0];
    const height = aabb[4] - aabb[1];
    const depth = aabb[5] - aabb[2];
    return width * height * depth;
}
/**
 * Gets the center of an AABB.
 */
export function getAABB3Center(aabb, dest = createVec3()) {
    dest[0] = (aabb[0] + aabb[3]) / 2;
    dest[1] = (aabb[1] + aabb[4]) / 2;
    dest[2] = (aabb[2] + aabb[5]) / 2;
    return dest;
}
/**
 * Gets the center of a 2D AABB.
 */
export function getAABB2Center(aabb, dest = createVec2()) {
    dest[0] = (aabb[2] + aabb[0]) / 2;
    dest[1] = (aabb[3] + aabb[1]) / 2;
    return dest;
}
/**
 * Collapses a 3D axis-aligned boundary, ready to expand to fit 3D points.
 * Creates new AABB if none supplied.
 */
export function collapseAABB3(aabb = createAABB3()) {
    aabb[0] = MAX_DOUBLE;
    aabb[1] = MAX_DOUBLE;
    aabb[2] = MAX_DOUBLE;
    aabb[3] = MIN_DOUBLE;
    aabb[4] = MIN_DOUBLE;
    aabb[5] = MIN_DOUBLE;
    return aabb;
}
/**
 * Collapses a 3D axis-aligned boundary, ready to expand to fit 3D points.
 * Creates new AABB if none supplied.
 */
export function collapseAABB3Int16(aabb = createAABB3Int16()) {
    aabb[0] = 65535;
    aabb[1] = 65535;
    aabb[2] = 65535;
    aabb[3] = -65535;
    aabb[4] = -65535;
    aabb[5] = -65535;
    return aabb;
}
/**
 * Converts an axis-aligned 3D boundary into an oriented boundary consisting of
 * an array of eight 3D positions, one for each corner of the boundary.
 *
 * @private
 */
export function AABB3ToOBB3(aabb = createAABB3(), obb = createOBB3()) {
    obb[0] = aabb[0];
    obb[1] = aabb[1];
    obb[2] = aabb[2];
    obb[3] = 1;
    obb[4] = aabb[3];
    obb[5] = aabb[1];
    obb[6] = aabb[2];
    obb[7] = 1;
    obb[8] = aabb[3];
    obb[9] = aabb[4];
    obb[10] = aabb[2];
    obb[11] = 1;
    obb[12] = aabb[0];
    obb[13] = aabb[4];
    obb[14] = aabb[2];
    obb[15] = 1;
    obb[16] = aabb[0];
    obb[17] = aabb[1];
    obb[18] = aabb[5];
    obb[19] = 1;
    obb[20] = aabb[3];
    obb[21] = aabb[1];
    obb[22] = aabb[5];
    obb[23] = 1;
    obb[24] = aabb[3];
    obb[25] = aabb[4];
    obb[26] = aabb[5];
    obb[27] = 1;
    obb[28] = aabb[0];
    obb[29] = aabb[4];
    obb[30] = aabb[5];
    obb[31] = 1;
    return obb;
}
/**
 * Expands the first axis-aligned 3D boundary to enclose the second, if required.
 */
export function expandAABB3(aabb1, aabb2) {
    if (aabb1[0] > aabb2[0]) {
        aabb1[0] = aabb2[0];
    }
    if (aabb1[1] > aabb2[1]) {
        aabb1[1] = aabb2[1];
    }
    if (aabb1[2] > aabb2[2]) {
        aabb1[2] = aabb2[2];
    }
    if (aabb1[3] < aabb2[3]) {
        aabb1[3] = aabb2[3];
    }
    if (aabb1[4] < aabb2[4]) {
        aabb1[4] = aabb2[4];
    }
    if (aabb1[5] < aabb2[5]) {
        aabb1[5] = aabb2[5];
    }
    return aabb1;
}
/**
 * Expands the first axis-aligned 2D boundary to enclose the second, if required.
 */
export function expandAABB2(aabb1, aabb2) {
    if (aabb1[0] > aabb2[0]) {
        aabb1[0] = aabb2[0];
    }
    if (aabb1[1] > aabb2[1]) {
        aabb1[1] = aabb2[1];
    }
    if (aabb1[3] < aabb2[3]) {
        aabb1[3] = aabb2[3];
    }
    if (aabb1[4] < aabb2[4]) {
        aabb1[4] = aabb2[4];
    }
    return aabb1;
}
/**
 * Expands an axis-aligned 3D boundary to enclose the given point, if needed.
 */
export function expandAABB3Point3(aabb, p) {
    if (aabb[0] > p[0]) {
        aabb[0] = p[0];
    }
    if (aabb[1] > p[1]) {
        aabb[1] = p[1];
    }
    if (aabb[2] > p[2]) {
        aabb[2] = p[2];
    }
    if (aabb[3] < p[0]) {
        aabb[3] = p[0];
    }
    if (aabb[4] < p[1]) {
        aabb[4] = p[1];
    }
    if (aabb[5] < p[2]) {
        aabb[5] = p[2];
    }
    return aabb;
}
/**
 * Expands an axis-aligned 2D boundary to enclose the given point, if needed.
 */
export function expandAABB2Point2(aabb, p) {
    if (aabb[0] > p[0]) {
        aabb[0] = p[0];
    }
    if (aabb[1] > p[1]) {
        aabb[1] = p[1];
    }
    if (aabb[3] < p[0]) {
        aabb[3] = p[0];
    }
    if (aabb[4] < p[1]) {
        aabb[4] = p[1];
    }
    return aabb;
}
/**
 * Expands an axis-aligned 3D boundary to enclose the given points, if needed.
 */
export function expandAABB3Points3(aabb, positions) {
    var x;
    var y;
    var z;
    for (var i = 0, len = positions.length; i < len; i += 3) {
        x = positions[i];
        y = positions[i + 1];
        z = positions[i + 2];
        if (aabb[0] > x) {
            aabb[0] = x;
        }
        if (aabb[1] > y) {
            aabb[1] = y;
        }
        if (aabb[2] > z) {
            aabb[2] = z;
        }
        if (aabb[3] < x) {
            aabb[3] = x;
        }
        if (aabb[4] < y) {
            aabb[4] = y;
        }
        if (aabb[5] < z) {
            aabb[5] = z;
        }
    }
    return aabb;
}
/**
 * Converts an axis-aligned 3D boundary into an oriented boundary consisting of
 * an array of eight 3D positions, one for each corner of the boundary.
 */
export function ABB3ToOBB3(aabb, obb = createOBB3()) {
    obb[0] = aabb[0];
    obb[1] = aabb[1];
    obb[2] = aabb[2];
    obb[3] = 1;
    obb[4] = aabb[3];
    obb[5] = aabb[1];
    obb[6] = aabb[2];
    obb[7] = 1;
    obb[8] = aabb[3];
    obb[9] = aabb[4];
    obb[10] = aabb[2];
    obb[11] = 1;
    obb[12] = aabb[0];
    obb[13] = aabb[4];
    obb[14] = aabb[2];
    obb[15] = 1;
    obb[16] = aabb[0];
    obb[17] = aabb[1];
    obb[18] = aabb[5];
    obb[19] = 1;
    obb[20] = aabb[3];
    obb[21] = aabb[1];
    obb[22] = aabb[5];
    obb[23] = 1;
    obb[24] = aabb[3];
    obb[25] = aabb[4];
    obb[26] = aabb[5];
    obb[27] = 1;
    obb[28] = aabb[0];
    obb[29] = aabb[4];
    obb[30] = aabb[5];
    obb[31] = 1;
    return obb;
}
/**
 * Finds the minimum axis-aligned 3D boundary enclosing the homogeneous 3D points (x,y,z,w) given in a flattened array.
 */
export const positions3ToAABB3 = (() => {
    const p = newFloatArray(3);
    return (positions, aabb, positionsDecompressMatrix) => {
        aabb = aabb || createAABB3();
        let xmin = MAX_DOUBLE;
        let ymin = MAX_DOUBLE;
        let zmin = MAX_DOUBLE;
        let xmax = MIN_DOUBLE;
        let ymax = MIN_DOUBLE;
        let zmax = MIN_DOUBLE;
        let x;
        let y;
        let z;
        for (let i = 0, len = positions.length; i < len; i += 3) {
            if (positionsDecompressMatrix) {
                p[0] = positions[i + 0];
                p[1] = positions[i + 1];
                p[2] = positions[i + 2];
                decompressPoint3WithMat4(p, positionsDecompressMatrix, p);
                x = p[0];
                y = p[1];
                z = p[2];
            }
            else {
                x = positions[i + 0];
                y = positions[i + 1];
                z = positions[i + 2];
            }
            if (x < xmin) {
                xmin = x;
            }
            if (y < ymin) {
                ymin = y;
            }
            if (z < zmin) {
                zmin = z;
            }
            if (x > xmax) {
                xmax = x;
            }
            if (y > ymax) {
                ymax = y;
            }
            if (z > zmax) {
                zmax = z;
            }
        }
        aabb[0] = xmin;
        aabb[1] = ymin;
        aabb[2] = zmin;
        aabb[3] = xmax;
        aabb[4] = ymax;
        aabb[5] = zmax;
        return aabb;
    };
})();
/**
 * Finds the minimum axis-aligned 3D boundary enclosing the homogeneous 3D points (x,y,z,w) given in a flattened array.
 */
export function OBB3ToAABB3(obb, aabb = createAABB3()) {
    let xmin = MAX_DOUBLE;
    let ymin = MAX_DOUBLE;
    let zmin = MAX_DOUBLE;
    let xmax = MIN_DOUBLE;
    let ymax = MIN_DOUBLE;
    let zmax = MIN_DOUBLE;
    let x;
    let y;
    let z;
    for (let i = 0, len = obb.length; i < len; i += 4) {
        x = obb[i + 0];
        y = obb[i + 1];
        z = obb[i + 2];
        if (x < xmin) {
            xmin = x;
        }
        if (y < ymin) {
            ymin = y;
        }
        if (z < zmin) {
            zmin = z;
        }
        if (x > xmax) {
            xmax = x;
        }
        if (y > ymax) {
            ymax = y;
        }
        if (z > zmax) {
            zmax = z;
        }
    }
    aabb[0] = xmin;
    aabb[1] = ymin;
    aabb[2] = zmin;
    aabb[3] = xmax;
    aabb[4] = ymax;
    aabb[5] = zmax;
    return aabb;
}
/**
 * Finds the minimum axis-aligned 3D boundary enclosing the given 3D points.
 */
export function points3ToAABB3(points, aabb = createAABB3()) {
    let xmin = MAX_DOUBLE;
    let ymin = MAX_DOUBLE;
    let zmin = MAX_DOUBLE;
    let xmax = MIN_DOUBLE;
    let ymax = MIN_DOUBLE;
    let zmax = MIN_DOUBLE;
    let x;
    let y;
    let z;
    for (let i = 0, len = points.length; i < len; i++) {
        x = points[i][0];
        y = points[i][1];
        z = points[i][2];
        if (x < xmin) {
            xmin = x;
        }
        if (y < ymin) {
            ymin = y;
        }
        if (z < zmin) {
            zmin = z;
        }
        if (x > xmax) {
            xmax = x;
        }
        if (y > ymax) {
            ymax = y;
        }
        if (z > zmax) {
            zmax = z;
        }
    }
    aabb[0] = xmin;
    aabb[1] = ymin;
    aabb[2] = zmin;
    aabb[3] = xmax;
    aabb[4] = ymax;
    aabb[5] = zmax;
    return aabb;
}
/**
 * Gets the 3D center of the given flat array of 3D positions.
 */
export function getPositions3Center(positions, center = createVec3()) {
    let xCenter = 0;
    let yCenter = 0;
    let zCenter = 0;
    for (let i = 0, len = positions.length; i < len; i += 3) {
        xCenter += positions[i + 0];
        yCenter += positions[i + 1];
        zCenter += positions[i + 2];
    }
    const numPositions = positions.length / 3;
    center[0] = xCenter / numPositions;
    center[1] = yCenter / numPositions;
    center[2] = zCenter / numPositions;
    return center;
}
/**
 * A plane within a {@link Frustum3}.
 */
export class FrustumPlane3 {
    testVertex;
    offset;
    normal;
    /**
     * Creates a new frustum plane.
     */
    constructor() {
        this.normal = createVec3();
        this.offset = 0;
        this.testVertex = createVec3();
    }
    /**
     * Sets the position and direction of the frustum plane.
     * @param nx
     * @param ny
     * @param nz
     * @param offset
     */
    set(nx, ny, nz, offset) {
        const s = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        this.normal[0] = nx * s;
        this.normal[1] = ny * s;
        this.normal[2] = nz * s;
        this.offset = offset * s;
        this.testVertex[0] = (this.normal[0] >= 0.0) ? 1 : 0;
        this.testVertex[1] = (this.normal[1] >= 0.0) ? 1 : 0;
        this.testVertex[2] = (this.normal[2] >= 0.0) ? 1 : 0;
    }
}
/**
 * Intersection state in which first boundary is completely inside the second.
 */
export const INSIDE = 1;
/**
 * Intersection state in which two boundaries partially intersect.
 */
export const INTERSECT = 2;
/**
 * Intersection state in which two boundaries do not intersect.
 */
export const OUTSIDE = 3;
/**
 * A 3D frustum defined as six planes.
 */
export class Frustum3 {
    /**
     * The six planes that comprise the frustum boundary.
     */
    planes;
    /**
     * Creates a new FrustumProjection
     */
    constructor() {
        this.planes = [
            new FrustumPlane3(), new FrustumPlane3(), new FrustumPlane3(),
            new FrustumPlane3(), new FrustumPlane3(), new FrustumPlane3()
        ];
    }
}
/**
 * Sets the extents of a frustum to the World-space volume defined by view and projection matrices.
 * Creates the frustum first if not given.
 */
export function setFrustum3(viewMat, projMat, frustum) {
    const m = mulMat4(projMat, viewMat, tempMat4a);
    const m0 = m[0];
    const m1 = m[1];
    const m2 = m[2];
    const m3 = m[3];
    const m4 = m[4];
    const m5 = m[5];
    const m6 = m[6];
    const m7 = m[7];
    const m8 = m[8];
    const m9 = m[9];
    const m10 = m[10];
    const m11 = m[11];
    const m12 = m[12];
    const m13 = m[13];
    const m14 = m[14];
    const m15 = m[15];
    frustum = frustum || new Frustum3();
    frustum.planes[0].set(m3 - m0, m7 - m4, m11 - m8, m15 - m12);
    frustum.planes[1].set(m3 + m0, m7 + m4, m11 + m8, m15 + m12);
    frustum.planes[2].set(m3 - m1, m7 - m5, m11 - m9, m15 - m13);
    frustum.planes[3].set(m3 + m1, m7 + m5, m11 + m9, m15 + m13);
    frustum.planes[4].set(m3 - m2, m7 - m6, m11 - m10, m15 - m14);
    frustum.planes[5].set(m3 + m2, m7 + m6, m11 + m10, m15 + m14);
    return frustum;
}
/**
 * Tests for intersection between a frustum and an axis-aligned 3D boundary.
 * @param frustum
 * @param aabb
 */
export function intersectFrustum3AABB3(frustum, aabb) {
    let ret = INSIDE;
    const min = tempVec3a;
    const max = tempVec3b;
    min[0] = aabb[0];
    min[1] = aabb[1];
    min[2] = aabb[2];
    max[0] = aabb[3];
    max[1] = aabb[4];
    max[2] = aabb[5];
    const bminmax = [min, max];
    for (let i = 0; i < 6; ++i) {
        const plane = frustum.planes[i];
        if (((plane.normal[0] * bminmax[plane.testVertex[0]][0]) +
            (plane.normal[1] * bminmax[plane.testVertex[1]][1]) +
            (plane.normal[2] * bminmax[plane.testVertex[2]][2]) +
            (plane.offset)) < 0.0) {
            return OUTSIDE;
        }
        if (((plane.normal[0] * bminmax[1 - plane.testVertex[0]][0]) +
            (plane.normal[1] * bminmax[1 - plane.testVertex[1]][1]) +
            (plane.normal[2] * bminmax[1 - plane.testVertex[2]][2]) +
            (plane.offset)) < 0.0) {
            ret = INTERSECT;
        }
    }
    return ret;
}
/**
 * Tests for intersection between two axis-aligned 3D boundaries.
 * @param aabb1
 * @param aabb2
 */
export function intersectAABB3s(aabb1, aabb2) {
    return INTERSECT;
    // let ret = INSIDE;
    // const min = tempVec3a;
    // const max = tempVec3b;
    // min[0] = aabb[0];
    // min[1] = aabb[1];
    // min[2] = aabb[2];
    // max[0] = aabb[3];
    // max[1] = aabb[4];
    // max[2] = aabb[5];
    // const bminmax = [min, max];
    // for (let i = 0; i < 6; ++i) {
    //     const plane = frustum.planes[i];
    //     if (((plane.normal[0] * bminmax[plane.testVertex[0]][0]) +
    //         (plane.normal[1] * bminmax[plane.testVertex[1]][1]) +
    //         (plane.normal[2] * bminmax[plane.testVertex[2]][2]) +
    //         (plane.offset)) < 0.0) {
    //         return OUTSIDE;
    //     }
    //     if (((plane.normal[0] * bminmax[1 - plane.testVertex[0]][0]) +
    //         (plane.normal[1] * bminmax[1 - plane.testVertex[1]][1]) +
    //         (plane.normal[2] * bminmax[1 - plane.testVertex[2]][2]) +
    //         (plane.offset)) < 0.0) {
    //         ret = INTERSECT;
    //     }
    // }
    // return ret;
}
/**
 * Tests if the given {@link boundaries!Frustum3 | Frustum3} intersects the given {@link constants!TrianglesPrimitive | TrianglesPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param positions
 * @param indices
 */
export function intersectFrustum3Triangles3(frustum, positions, indices) {
    return true;
}
/**
 * Tests if the given {@link boundaries!Frustum3 | Frustum3} intersects the given triangle primitive.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param a
 * @param b
 * @param c
 */
export function intersectFrustum3Triangle3(frustum, a, b, c) {
    return true;
}
/**
 * Tests if the given {@link boundaries!Frustum3 | Frustum3} intersects the given
 * {@link constants!LinesPrimitive | LinesPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param positions
 * @param indices
 */
export function intersectFrustum3Lines3(frustum, positions, indices) {
    return true;
}
/**
 * Tests if the given {@link boundaries!Frustum3 | Frustum3} intersects the
 * given {@link constants!PointsPrimitive | PointsPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param positions
 */
export function intersectFrustum3Positions3(frustum, positions) {
    return true;
}
/**
 * Tests if the given {@link boundaries!Frustum3 | Frustum3} intersects the given position.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param position
 */
export function intersectFrustum3Point3(frustum, position) {
    return true;
}
/**
 * Tests if the given AABB intersects the given {@link constants!TrianglesPrimitive | TrianglesPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param aabb
 * @param positions
 * @param indices
 */
export function intersectAABB3Triangles3(aabb, positions, indices) {
    for (let i = 0, len = indices.length; i < len; i += 3) {
        // if (aabbIntersectsTriangle(positions, indices[i], indices[i + 1], indices[i + 2], aabb)) {
        //     return true;
        // }
    }
    return false;
}
/**
 * Tests if the given AABB intersects the given {@link constants!LinesPrimitive | LinesPrimitive} geometry.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param aabb
 * @param positions
 * @param indices
 */
export function intersectAABB3Lines3(aabb, positions, indices) {
    return false;
}
/**
 * Tests if the given AABB intersects the given {@link constants!PointsPrimitive | PointsPrimitive} vertex positions.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param aabb
 * @param positions
 */
export function intersectAABB3Positions3(aabb, positions) {
    const xmin = aabb[0];
    const ymin = aabb[1];
    const zmin = aabb[2];
    const xmax = aabb[3];
    const ymax = aabb[4];
    const zmax = aabb[5];
    for (let i = 0, len = positions.length; i < len; i += 3) {
        const x = positions[i];
        if (xmin <= x && x <= xmax) {
            const y = positions[i + 1];
            if (ymin <= y && y <= ymax) {
                const z = positions[i + 2];
                if (zmin <= z && z <= zmax) {
                    return true;
                }
            }
        }
    }
    return false;
}
/**
 * Tets if the given 3D AABB contains the given 3D position.
 * @param aabb
 * @param p
 */
export function containsAABB3Point3(aabb, p) {
    return (aabb[0] <= p[0] && p[0] <= aabb[3] &&
        aabb[1] <= p[1] && p[1] <= aabb[4] &&
        aabb[2] <= p[2] && p[2] <= aabb[5]);
}
/**
 * Tets if the given 2D AABB contains the given 2D position.
 * @param aabb
 * @param p
 */
export function containsAABB2Point2(aabb, p) {
    return (aabb[0] <= p[0] && p[0] <= aabb[3] &&
        aabb[1] <= p[1] && p[1] <= aabb[4]);
}
//# sourceMappingURL=index.js.map