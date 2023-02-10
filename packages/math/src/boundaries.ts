/**
 * <img src="http://xeokit.io/img/kdtree.jpeg" />
 *
 * ## Boundaries Math Library
 *
 * * Axis-aligned boundaries (AABB)
 * * Object-aligned boundaries (OBB)
 * * 2D and 3D
 * * Transformable OOBs
 * * Create boundaries from positions
 * * Find center of positions
 * * Frustum-boundary intersection tests
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/math
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import * as boundaries from "@xeokit/math/boundaries";
 *
 * //..TODO
 * ````
 *
 * @module @xeokit/math/boundaries
 */

import * as math from "./math";
import * as matrix from "./matrix";
import {decompressPosition} from "@xeokit/compression";


const tempVec3a = matrix.createVec3();
const tempVec3b = matrix.createVec3();
const tempMat4a = matrix.createMat4();

/**
 * Returns a new, uninitialized 3D axis-aligned bounding box.
 */
export function createAABB3(values?: math.FloatArrayParam): Float64Array {
    // @ts-ignore
    return new Float64Array(values || 6);
}

/**
 * Returns a new, uninitialized 2D axis-aligned bounding box.
 */
export function createAABB2(values?: math.FloatArrayParam): math.FloatArrayParam {
    // @ts-ignore
    return newFloatArray(values || 4);
}

/**
 * Returns a new, uninitialized 3D oriented bounding box (OBB).
 */
export function createOBB3(values?: math.FloatArrayParam): math.FloatArrayParam {
    // @ts-ignore
    return newFloatArray(values || 32);
}

/**
 * Returns a new, uninitialized 2D oriented bounding box (OBB).
 */
export function createOBB2(values?: math.FloatArrayParam): math.FloatArrayParam {
    // @ts-ignore
    return newFloatArray(values || 16);
}

/** Returns a new 3D bounding sphere */
export function createSphere3(
    x: number,
    y: number,
    z: number,
    r: number
): math.FloatArrayParam {
    return math.newFloatArray([x, y, z, r]);
}

/**
 * Transforms an createOBB3 by a 4x4 matrix.
 */
export function transformOBB3(
    m: math.FloatArrayParam,
    p: math.FloatArrayParam,
    p2: math.FloatArrayParam = p
): math.FloatArrayParam {
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

/** Returns true if the first AABB contains the second AABB.
 */
export function containsAABB3(
    aabb1: math.FloatArrayParam,
    aabb2: math.FloatArrayParam
): boolean {
    const result =
        aabb1[0] <= aabb2[0] &&
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
export const getAABB3Diag: Function = (() => {
    const min = math.newFloatArray(3);
    const max = math.newFloatArray(3);
    const tempVec3 = math.newFloatArray(3);
    return (aabb: math.FloatArrayParam): number => {
        min[0] = aabb[0];
        min[1] = aabb[1];
        min[2] = aabb[2];
        max[0] = aabb[3];
        max[1] = aabb[4];
        max[2] = aabb[5];
        matrix.subVec3(max, min, tempVec3);
        return Math.abs(matrix.lenVec3(tempVec3));
    };
})();

/**
 * Get a diagonal boundary size that is symmetrical about the given point.
 */
export const getAABB3DiagPoint = (() => {
    const min = math.newFloatArray(3);
    const max = math.newFloatArray(3);
    const tempVec3 = math.newFloatArray(3);

    return (aabb: math.FloatArrayParam, p: math.FloatArrayParam): number => {
        min[0] = aabb[0];
        min[1] = aabb[1];
        min[2] = aabb[2];

        max[0] = aabb[3];
        max[1] = aabb[4];
        max[2] = aabb[5];

        const diagVec = matrix.subVec3(max, min, tempVec3);

        const xneg = p[0] - aabb[0];
        const xpos = aabb[3] - p[0];
        const yneg = p[1] - aabb[1];
        const ypos = aabb[4] - p[1];
        const zneg = p[2] - aabb[2];
        const zpos = aabb[5] - p[2];

        diagVec[0] += xneg > xpos ? xneg : xpos;
        diagVec[1] += yneg > ypos ? yneg : ypos;
        diagVec[2] += zneg > zpos ? zneg : zpos;

        return Math.abs(matrix.lenVec3(diagVec));
    };
})();

/**
 * Gets the area of an AABB.
 */
export function getAABB3Area(aabb: math.FloatArrayParam): number {
    const width = aabb[3] - aabb[0];
    const height = aabb[4] - aabb[1];
    const depth = aabb[5] - aabb[2];
    return width * height * depth;
}

/**
 * Gets the center of an AABB.
 */
export function getAABB3Center(
    aabb: math.FloatArrayParam,
    dest: math.FloatArrayParam = matrix.createVec3()
): math.FloatArrayParam {
    dest[0] = (aabb[0] + aabb[3]) / 2;
    dest[1] = (aabb[1] + aabb[4]) / 2;
    dest[2] = (aabb[2] + aabb[5]) / 2;
    return dest;
}

/**
 * Gets the center of a 2D AABB.
 */
export function getAABB2Center(
    aabb: math.FloatArrayParam,
    dest: math.FloatArrayParam = matrix.createVec2()
): math.FloatArrayParam {
    dest[0] = (aabb[2] + aabb[0]) / 2;
    dest[1] = (aabb[3] + aabb[1]) / 2;
    return dest;
}

/**
 * Collapses a 3D axis-aligned boundary, ready to expand to fit 3D points.
 * Creates new AABB if none supplied.
 */
export function collapseAABB3(aabb: math.FloatArrayParam = createAABB3()): math.FloatArrayParam {
    aabb[0] = math.MAX_DOUBLE;
    aabb[1] = math.MAX_DOUBLE;
    aabb[2] = math.MAX_DOUBLE;
    aabb[3] = math.MIN_DOUBLE;
    aabb[4] = math.MIN_DOUBLE;
    aabb[5] = math.MIN_DOUBLE;
    return aabb;
}

/**
 * Converts an axis-aligned 3D boundary into an oriented boundary consisting of
 * an array of eight 3D positions, one for each corner of the boundary.
 *
 * @private
 */
export function AABB3ToOBB3(aabb: math.FloatArrayParam = createAABB3(), obb = createOBB3()): math.FloatArrayParam {
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
export function expandAABB3(aabb1: math.FloatArrayParam, aabb2: math.FloatArrayParam) {
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
 * Expands an axis-aligned 3D boundary to enclose the given point, if needed.
 */
export function expandAABB3Point3(aabb: math.FloatArrayParam, p: math.FloatArrayParam) {

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
 * Expands an axis-aligned 3D boundary to enclose the given points, if needed.
 */
export function expandAABB3Points3(aabb: math.FloatArrayParam, positions: math.FloatArrayParam): math.FloatArrayParam {
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
export function ABB3ToOBB3(
    aabb: math.FloatArrayParam,
    obb: math.FloatArrayParam = createOBB3()
): math.FloatArrayParam {
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
    const p = math.newFloatArray(3);

    return (
        positions: math.FloatArrayParam,
        aabb: math.FloatArrayParam,
        positionsDecompressMatrix: math.FloatArrayParam
    ): math.FloatArrayParam => {
        aabb = aabb || createAABB3();

        let xmin = math.MAX_DOUBLE;
        let ymin = math.MAX_DOUBLE;
        let zmin = math.MAX_DOUBLE;
        let xmax = math.MIN_DOUBLE;
        let ymax = math.MIN_DOUBLE;
        let zmax = math.MIN_DOUBLE;

        let x;
        let y;
        let z;

        for (let i = 0, len = positions.length; i < len; i += 3) {
            if (positionsDecompressMatrix) {
                p[0] = positions[i + 0];
                p[1] = positions[i + 1];
                p[2] = positions[i + 2];

                decompressPosition(p, positionsDecompressMatrix, p);

                x = p[0];
                y = p[1];
                z = p[2];
            } else {
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
export function OBB3ToAABB3(
    obb: math.FloatArrayParam,
    aabb: math.FloatArrayParam = createAABB3()
): math.FloatArrayParam {
    let xmin = math.MAX_DOUBLE;
    let ymin = math.MAX_DOUBLE;
    let zmin = math.MAX_DOUBLE;
    let xmax = math.MIN_DOUBLE;
    let ymax = math.MIN_DOUBLE;
    let zmax = math.MIN_DOUBLE;

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
export function points3ToAABB3(
    points: number[][],
    aabb: math.FloatArrayParam = createAABB3()
): math.FloatArrayParam {
    let xmin = math.MAX_DOUBLE;
    let ymin = math.MAX_DOUBLE;
    let zmin = math.MAX_DOUBLE;
    let xmax = math.MIN_DOUBLE;
    let ymax = math.MIN_DOUBLE;
    let zmax = math.MIN_DOUBLE;

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
export function getPositionsCenter(
    positions: math.FloatArrayParam,
    center: math.FloatArrayParam = matrix.createVec3()
): math.FloatArrayParam {
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
 * A plane within a {@link Frustum}.
 */
export class FrustumPlane {

    public testVertex: math.FloatArrayParam;
    public offset: number;
    public normal: math.FloatArrayParam;

    /**
     * Creates a new frustum plane.
     */
    constructor() {
        this.normal = matrix.createVec3();
        this.offset = 0;
        this.testVertex = matrix.createVec3();
    }

    /**
     * Sets the position and direction of the frustum plane.
     * @param nx
     * @param ny
     * @param nz
     * @param offset
     */
    set(nx: number, ny: number, nz: number, offset: number) {
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
 * A frustum defined as six planes.
 */
export class Frustum {

    /**
     * The six planes that comprise the frustum boundary.
     */
    public planes: FrustumPlane[];

    /**
     *
     */
    static INSIDE: number = 0;
    static INTERSECT: number = 1;
    static OUTSIDE: number = 2;

    /**
     * Creates a new Frustum
     */
    constructor() {
        this.planes = [
            new FrustumPlane(), new FrustumPlane(), new FrustumPlane(),
            new FrustumPlane(), new FrustumPlane(), new FrustumPlane()
        ];
    }
}

/**
 * Sets the extents of a frustum to the World-space volume defined by view and projection matrices.
 * @param frustum
 * @param viewMat
 * @param projMat
 */
export function setFrustum(frustum: Frustum, viewMat: math.FloatArrayParam, projMat: math.FloatArrayParam) {
    const m = matrix.mulMat4(projMat, viewMat, tempMat4a);
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
    frustum.planes[0].set(m3 - m0, m7 - m4, m11 - m8, m15 - m12);
    frustum.planes[1].set(m3 + m0, m7 + m4, m11 + m8, m15 + m12);
    frustum.planes[2].set(m3 - m1, m7 - m5, m11 - m9, m15 - m13);
    frustum.planes[3].set(m3 + m1, m7 + m5, m11 + m9, m15 + m13);
    frustum.planes[4].set(m3 - m2, m7 - m6, m11 - m10, m15 - m14);
    frustum.planes[5].set(m3 + m2, m7 + m6, m11 + m10, m15 + m14);
}

/**
 * Tests for intersection between a frustum and an axis-aligned 3D boundary.
 * @param frustum
 * @param aabb
 */
export function frustumIntersectsAABB3(frustum: Frustum, aabb: math.FloatArrayParam): number {
    let ret = Frustum.INSIDE;
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
            return Frustum.OUTSIDE;
        }
        if (((plane.normal[0] * bminmax[1 - plane.testVertex[0]][0]) +
            (plane.normal[1] * bminmax[1 - plane.testVertex[1]][1]) +
            (plane.normal[2] * bminmax[1 - plane.testVertex[2]][2]) +
            (plane.offset)) < 0.0) {
            ret = Frustum.INTERSECT;
        }
    }
    return ret;
}
