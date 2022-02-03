/*
 * Geometry compression and decompression utilities.
 */

import {FloatArrayType} from "./math";
import {
    identityMat3,
    identityMat4,
    mat3,
    mat4,
    mulMat3,
    mulMat4,
    scalingMat3v,
    scalingMat4v,
    translationMat3v,
    translationMat4v
} from "./matrix";
import {vec3} from "./vector";

/**
 * Gets the boundary of a flat positions array
 * @param array
 * @param min
 * @param max
 */
export function getPositionsBounds(array: FloatArrayType, min: FloatArrayType, max: FloatArrayType) {
    let i, j;
    for (i = 0; i < 3; i++) {
        min[i] = Number.MAX_VALUE;
        max[i] = -Number.MAX_VALUE;
    }
    for (i = 0; i < array.length; i += 3) {
        for (j = 0; j < 3; j++) {
            min[j] = Math.min(min[j], array[i + j]);
            max[j] = Math.max(max[j], array[i + j]);
        }
    }
}

/**
 * Creates a de-quantization matrix from a flat positions array
 */
export const createPositionsDecodeMatrix = (function () {
    const translate = mat4();
    const scale = mat4();
    return function (aabb: FloatArrayType, positionsDecodeMatrix: FloatArrayType) {
        positionsDecodeMatrix = positionsDecodeMatrix || mat4();
        const xmin = aabb[0];
        const ymin = aabb[1];
        const zmin = aabb[2];
        const xwid = aabb[3] - xmin;
        const ywid = aabb[4] - ymin;
        const zwid = aabb[5] - zmin;
        const maxInt = 65535;
        identityMat4(translate);
        translationMat4v(aabb, translate);
        identityMat4(scale);
        scalingMat4v([xwid / maxInt, ywid / maxInt, zwid / maxInt], scale);
        mulMat4(translate, scale, positionsDecodeMatrix);
        return positionsDecodeMatrix;
    };
})();

/**
 * Quantizes a flat positions array
 */
export var compressPositions = (function () { // http://cg.postech.ac.kr/research/mesh_comp_mobile/mesh_comp_mobile_conference.pdf
    const translate = mat4();
    const scale = mat4();
    return function (array: FloatArrayType, min: FloatArrayType, max: FloatArrayType) {
        const quantized = new Uint16Array(array.length);
        var multiplier = new Float32Array([
            max[0] !== min[0] ? 65535 / (max[0] - min[0]) : 0,
            max[1] !== min[1] ? 65535 / (max[1] - min[1]) : 0,
            max[2] !== min[2] ? 65535 / (max[2] - min[2]) : 0
        ]);
        let i;
        for (i = 0; i < array.length; i += 3) {
            quantized[i + 0] = Math.floor((array[i + 0] - min[0]) * multiplier[0]);
            quantized[i + 1] = Math.floor((array[i + 1] - min[1]) * multiplier[1]);
            quantized[i + 2] = Math.floor((array[i + 2] - min[2]) * multiplier[2]);
        }
        identityMat4(translate);
        translationMat4v(min, translate);
        identityMat4(scale);
        scalingMat4v([
            (max[0] - min[0]) / 65535,
            (max[1] - min[1]) / 65535,
            (max[2] - min[2]) / 65535
        ], scale);
        const decodeMat = mulMat4(translate, scale, identityMat4());
        return {
            quantized: quantized,
            decodeMatrix: decodeMat
        };
    };
})();

/**
 * De-quantizes a 3D position
 * @param position
 * @param decodeMatrix
 * @param dest
 */
export function decompressPosition(position: Uint16Array|FloatArrayType, decodeMatrix: FloatArrayType, dest: FloatArrayType): FloatArrayType {
    dest[0] = position[0] * decodeMatrix[0] + decodeMatrix[12];
    dest[1] = position[1] * decodeMatrix[5] + decodeMatrix[13];
    dest[2] = position[2] * decodeMatrix[10] + decodeMatrix[14];
    return dest;
}

/**
 * De-quantizes an axis-aligned 3D boundary
 * @param aabb
 * @param decodeMatrix
 * @param dest
 */
export function decompressAABB(aabb: FloatArrayType, decodeMatrix: FloatArrayType, dest: FloatArrayType = aabb): FloatArrayType {
    dest[0] = aabb[0] * decodeMatrix[0] + decodeMatrix[12];
    dest[1] = aabb[1] * decodeMatrix[5] + decodeMatrix[13];
    dest[2] = aabb[2] * decodeMatrix[10] + decodeMatrix[14];
    dest[3] = aabb[3] * decodeMatrix[0] + decodeMatrix[12];
    dest[4] = aabb[4] * decodeMatrix[5] + decodeMatrix[13];
    dest[5] = aabb[5] * decodeMatrix[10] + decodeMatrix[14];
    return dest;
}

/**
 * De-quantizes a flat array of positions
 * @param positions
 * @param decodeMatrix
 * @param dest
 */
export function decompressPositions(positions: FloatArrayType, decodeMatrix: FloatArrayType, dest: Float32Array = new Float32Array(positions.length)): Float32Array {
    for (let i = 0, len = positions.length; i < len; i += 3) {
        dest[i + 0] = positions[i + 0] * decodeMatrix[0] + decodeMatrix[12];
        dest[i + 1] = positions[i + 1] * decodeMatrix[5] + decodeMatrix[13];
        dest[i + 2] = positions[i + 2] * decodeMatrix[10] + decodeMatrix[14];
    }
    return dest;
}

/**
 * Gets the 2D min/max boundary of a flat array of UV coordinate
 * @param array
 */
export function getUVBounds(array: FloatArrayType): { min: Float32Array | Float64Array, max: Float32Array | Float64Array } {
    const min = new Float32Array(2);
    const max = new Float32Array(2);
    let i, j;
    for (i = 0; i < 2; i++) {
        min[i] = Number.MAX_VALUE;
        max[i] = -Number.MAX_VALUE;
    }
    for (i = 0; i < array.length; i += 2) {
        for (j = 0; j < 2; j++) {
            min[j] = Math.min(min[j], array[i + j]);
            max[j] = Math.max(max[j], array[i + j]);
        }
    }
    return {
        min: min,
        max: max
    };
}

/**
 * Quantizes a flat array of UV coordinates
 */
export var compressUVs = (function () {
    const translate = mat3();
    const scale = mat3();
    return function (array: FloatArrayType, min: FloatArrayType, max: FloatArrayType): {
        quantized: Uint16Array,
        decodeMatrix: FloatArrayType | Float64Array
    } {
        const quantized = new Uint16Array(array.length);
        const multiplier = new Float32Array([
            65535 / (max[0] - min[0]),
            65535 / (max[1] - min[1])
        ]);
        let i;
        for (i = 0; i < array.length; i += 2) {
            quantized[i + 0] = Math.floor((array[i + 0] - min[0]) * multiplier[0]);
            quantized[i + 1] = Math.floor((array[i + 1] - min[1]) * multiplier[1]);
        }
        identityMat3(translate);
        translationMat3v(min, translate);
        identityMat3(scale);
        scalingMat3v([
            (max[0] - min[0]) / 65535,
            (max[1] - min[1]) / 65535
        ], scale);
        const decodeMat = mulMat3(translate, scale, identityMat3());
        return {
            quantized: quantized,
            decodeMatrix: decodeMat
        };
    };
})();

/**
 * Oct-encodes a flat array of normal vectors
 * @param array
 */
export function compressNormals(array: FloatArrayType): Int8Array { // http://jcgt.org/published/0003/02/01/

    // Note: three elements for each encoded normal, in which the last element in each triplet is redundant.
    // This is to work around a mysterious WebGL issue where 2-element normals just wouldn't work in the shader :/

    const encoded = new Int8Array(array.length);
    let oct, dec, best, currentCos, bestCos;
    for (let i = 0; i < array.length; i += 3) {
        // Test various combinations of ceil and floor
        // to minimize rounding errors
        best = oct = octEncodeVec3(array, i, "floor", "floor");
        dec = octDecodeVec2(oct);
        currentCos = bestCos = dot(array, i, dec);
        oct = octEncodeVec3(array, i, "ceil", "floor");
        dec = octDecodeVec2(oct);
        currentCos = dot(array, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeVec3(array, i, "floor", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(array, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeVec3(array, i, "ceil", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(array, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        encoded[i] = best[0];
        encoded[i + 1] = best[1];
    }
    return encoded;
}

/**
 */
export function octEncodeVec3(array: FloatArrayType, i: number, xfunc: any, yfunc: any): Int8Array { // Oct-encode single normal vector in 2 bytes
    let x = array[i] / (Math.abs(array[i]) + Math.abs(array[i + 1]) + Math.abs(array[i + 2]));
    let y = array[i + 1] / (Math.abs(array[i]) + Math.abs(array[i + 1]) + Math.abs(array[i + 2]));
    if (array[i + 2] < 0) {
        let tempx = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
        let tempy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
        x = tempx;
        y = tempy;
    }
    // @ts-ignore
    return new Int8Array([Math[xfunc](x * 127.5 + (x < 0 ? -1 : 0)), Math[yfunc](y * 127.5 + (y < 0 ? -1 : 0))]);
}


/**
 * Dot product of a normal in an array against a candidate decoding
 */
function dot(array: FloatArrayType, i: number, vec3: FloatArrayType): number {
    return array[i] * vec3[0] + array[i + 1] * vec3[1] + array[i + 2] * vec3[2];
}

/**
 */
export function decompressUV(uv: FloatArrayType, decodeMatrix: FloatArrayType, dest = new Float32Array(2)) {
    dest[0] = uv[0] * decodeMatrix[0] + decodeMatrix[6];
    dest[1] = uv[1] * decodeMatrix[4] + decodeMatrix[7];
}

/**
 *
 */
export function decompressUVs(uvs: FloatArrayType, decodeMatrix: FloatArrayType, dest = new Float32Array(uvs.length)) {
    for (let i = 0, len = uvs.length; i < len; i += 3) {
        dest[i + 0] = uvs[i + 0] * decodeMatrix[0] + decodeMatrix[6];
        dest[i + 1] = uvs[i + 1] * decodeMatrix[4] + decodeMatrix[7];
    }
    return dest;
}

/**
 *
 */
export function decompressNormal(oct: FloatArrayType, result: FloatArrayType): FloatArrayType {
    let x = oct[0];
    let y = oct[1];
    x = (2 * x + 1) / 255;
    y = (2 * y + 1) / 255;
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) {
        x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
        y = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
    }
    const length = Math.sqrt(x * x + y * y + z * z);
    result[0] = x / length;
    result[1] = y / length;
    result[2] = z / length;
    return result;
}

/**
 *
 */
export function decompressNormals(octs: string | any[], result: FloatArrayType): FloatArrayType {
    for (let i = 0, j = 0, len = octs.length; i < len; i += 2) {
        let x = octs[i + 0];
        let y = octs[i + 1];
        x = (2 * x + 1) / 255;
        y = (2 * y + 1) / 255;
        const z = 1 - Math.abs(x) - Math.abs(y);
        if (z < 0) {
            x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
            y = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
        }
        const length = Math.sqrt(x * x + y * y + z * z);
        result[j + 0] = x / length;
        result[j + 1] = y / length;
        result[j + 2] = z / length;
        j += 3;
    }
    return result;
}

/**
 *
 * @param oct
 * @param result
 */
export function octDecodeVec2(oct: Int8Array, result: FloatArrayType = vec3()): FloatArrayType {
    let x = oct[0];
    let y = oct[1];
    x = (2 * x + 1) / 255;
    y = (2 * y + 1) / 255;
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) {
        x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
        y = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
    }
    const length = Math.sqrt(x * x + y * y + z * z);
    result[0] = x / length;
    result[1] = y / length;
    result[2] = z / length;
    return result;
}

/**
 *
 */
export function octDecodeVec2s(octs: Int8Array, result: FloatArrayType): FloatArrayType {
    for (let i = 0, j = 0, len = octs.length; i < len; i += 2) {
        let x = octs[i + 0];
        let y = octs[i + 1];
        x = (2 * x + 1) / 255;
        y = (2 * y + 1) / 255;
        const z = 1 - Math.abs(x) - Math.abs(y);
        if (z < 0) {
            x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
            y = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
        }
        const length = Math.sqrt(x * x + y * y + z * z);
        result[j + 0] = x / length;
        result[j + 1] = y / length;
        result[j + 2] = z / length;
        j += 3;
    }
    return result;
}
