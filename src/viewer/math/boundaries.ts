import { FloatArrayType, MAX_DOUBLE, MIN_DOUBLE, newFloatArray } from "./math";
import { lenVec3, subVec3, vec2, vec3 } from "./vector";
import { decompressPosition } from "./compression";

/**
 * Returns a new, uninitialized 3D axis-aligned bounding box.
 */
export function AABB3(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return newFloatArray(values || 6);
}

/**
 * Returns a new, uninitialized 2D axis-aligned bounding box.
 */
export function AABB2(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return newFloatArray(values || 4);
}

/**
 * Returns a new, uninitialized 3D oriented bounding box (OBB).
 */
export function OBB3(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return newFloatArray(values || 32);
}

/**
 * Returns a new, uninitialized 2D oriented bounding box (OBB).
 */
export function OBB2(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return newFloatArray(values || 16);
}

/** Returns a new 3D bounding sphere */
export function Sphere3(
    x: number,
    y: number,
    z: number,
    r: number
): FloatArrayType {
    return newFloatArray([x, y, z, r]);
}

/**
 * Transforms an OBB3 by a 4x4 matrix.
 */
export function transformOBB3(
    m: FloatArrayType,
    p: FloatArrayType,
    p2: FloatArrayType = p
): FloatArrayType {
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
    aabb1: FloatArrayType,
    aabb2: FloatArrayType
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
 * Gets the diagonal size of an AABB3 given as minima and maxima.
 */
export const getAABB3Diag: Function = (() => {
    const min = newFloatArray(3);
    const max = newFloatArray(3);
    const tempVec3 = newFloatArray(3);
    return (aabb: FloatArrayType): number => {
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

    return (aabb: FloatArrayType, p: FloatArrayType): number => {
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
export function getAABB3Area(aabb: FloatArrayType): number {
    const width = aabb[3] - aabb[0];
    const height = aabb[4] - aabb[1];
    const depth = aabb[5] - aabb[2];
    return width * height * depth;
}

/**
 * Gets the center of an AABB.
 */
export function getAABB3Center(
    aabb: FloatArrayType,
    dest: FloatArrayType = vec3()
): FloatArrayType {
    dest[0] = (aabb[0] + aabb[3]) / 2;
    dest[1] = (aabb[1] + aabb[4]) / 2;
    dest[2] = (aabb[2] + aabb[5]) / 2;
    return dest;
}

/**
 * Gets the center of a 2D AABB.
 */
export function getAABB2Center(
    aabb: FloatArrayType,
    dest: FloatArrayType = vec2()
): FloatArrayType {
    dest[0] = (aabb[2] + aabb[0]) / 2;
    dest[1] = (aabb[3] + aabb[1]) / 2;
    return dest;
}

/**
 * Collapses a 3D axis-aligned boundary, ready to expand to fit 3D points.
 * Creates new AABB if none supplied.
 */
export function collapseAABB3(aabb: FloatArrayType = AABB3()): FloatArrayType {
    aabb[0] = MAX_DOUBLE;
    aabb[1] = MAX_DOUBLE;
    aabb[2] = MAX_DOUBLE;
    aabb[3] = MIN_DOUBLE;
    aabb[4] = MIN_DOUBLE;
    aabb[5] = MIN_DOUBLE;
    return aabb;
}

/**
 * Converts an axis-aligned 3D boundary into an oriented boundary consisting of
 * an array of eight 3D positions, one for each corner of the boundary.
 */
export function ABB3ToOBB3(
    aabb: FloatArrayType,
    obb: FloatArrayType = OBB3()
): FloatArrayType {
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

    return (
        positions: FloatArrayType,
        aabb: FloatArrayType,
        positionsDecodeMatrix: FloatArrayType
    ): FloatArrayType => {
        aabb = aabb || AABB3();

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
            if (positionsDecodeMatrix) {
                p[0] = positions[i + 0];
                p[1] = positions[i + 1];
                p[2] = positions[i + 2];

                decompressPosition(p, positionsDecodeMatrix, p);

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
    obb: FloatArrayType,
    aabb: FloatArrayType = AABB3()
): FloatArrayType {
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
export function points3ToAABB3(
    points: number[][],
    aabb: FloatArrayType = AABB3()
): FloatArrayType {
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
export function getPositionsCenter(
    positions: FloatArrayType,
    center: FloatArrayType = vec3()
): FloatArrayType {
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
