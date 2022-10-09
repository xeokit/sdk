/*
 * Geometry compression and decompression utilities.
 */

import {FloatArrayType} from "../math";
import {
    identityMat3,
    identityMat4,
    mat3,
    mat4,
    mulMat3,
    mulMat4,
    scalingMat3v,
    scalingMat4v, transformVec3,
    translationMat3v,
    translationMat4v
} from "../matrix";
import {normalizeVec3, vec3} from "../vector";

const translate: FloatArrayType = mat4();
const scale: FloatArrayType = mat4();

/**
 * Gets the boundary of a flat positions array.
 *
 * @param array
 * @param min
 * @param max
 */
export function getPositionsBounds(array: FloatArrayType, min?: FloatArrayType, max?: FloatArrayType) {
    let i, j;
    min = min || new Float64Array(3);
    max = max || new Float64Array(3);
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
    return {
        min,
        max
    };
}

/**
 * Creates a de-quantization matrix from a flat positions array
 */
export function createPositionsDecompressMatrix(aabb: FloatArrayType, positionsDecompressMatrix: FloatArrayType) {
    positionsDecompressMatrix = positionsDecompressMatrix || mat4();
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
    mulMat4(translate, scale, positionsDecompressMatrix);
    return positionsDecompressMatrix;
}

/**
 * Compresses a flat positions array
 */
export function compressPositions(array: FloatArrayType, min: FloatArrayType, max: FloatArrayType) {
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
    const decompressMatrix = mulMat4(translate, scale, identityMat4());
    return {
        quantized: quantized,
        decompressMatrix: decompressMatrix
    };
}

/**
 * Decompresses a 3D position
 * @param position
 * @param decompressMatrix
 * @param dest
 */
export function decompressPosition(position: FloatArrayType, decompressMatrix: FloatArrayType, dest: FloatArrayType = position): FloatArrayType {
    dest[0] = position[0] * decompressMatrix[0] + decompressMatrix[12];
    dest[1] = position[1] * decompressMatrix[5] + decompressMatrix[13];
    dest[2] = position[2] * decompressMatrix[10] + decompressMatrix[14];
    return dest;
}

/**
 * Decompresses an axis-aligned 3D boundary
 * @param aabb
 * @param decompressMatrix
 * @param dest
 */
export function decompressAABB(aabb: FloatArrayType, decompressMatrix: FloatArrayType, dest: FloatArrayType = aabb): FloatArrayType {
    dest[0] = aabb[0] * decompressMatrix[0] + decompressMatrix[12];
    dest[1] = aabb[1] * decompressMatrix[5] + decompressMatrix[13];
    dest[2] = aabb[2] * decompressMatrix[10] + decompressMatrix[14];
    dest[3] = aabb[3] * decompressMatrix[0] + decompressMatrix[12];
    dest[4] = aabb[4] * decompressMatrix[5] + decompressMatrix[13];
    dest[5] = aabb[5] * decompressMatrix[10] + decompressMatrix[14];
    return dest;
}

/**
 * Decompresses a flat array of positions
 * @param positions
 * @param decompressMatrix
 * @param dest
 */
export function decompressPositions(positions: FloatArrayType, decompressMatrix: FloatArrayType, dest: Float32Array = new Float32Array(positions.length)): Float32Array {
    for (let i = 0, len = positions.length; i < len; i += 3) {
        dest[i + 0] = positions[i + 0] * decompressMatrix[0] + decompressMatrix[12];
        dest[i + 1] = positions[i + 1] * decompressMatrix[5] + decompressMatrix[13];
        dest[i + 2] = positions[i + 2] * decompressMatrix[10] + decompressMatrix[14];
    }
    return dest;
}

/**
 * Gets the 2D min/max boundary of a flat array of UV coordinate
 * @param array
 */
export function getUVBounds(array: FloatArrayType): { min: FloatArrayType, max: FloatArrayType } {
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
 * Compresses a flat array of UV coordinates
 */
export var compressUVs = (function () {
    const translate = mat3();
    const scale = mat3();
    return function (array: FloatArrayType, min: FloatArrayType, max: FloatArrayType): {
        quantized: Uint16Array,
        decompressMatrix: FloatArrayType | Float64Array
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
        const decompressMatrix = mulMat3(translate, scale, identityMat3());
        return {
            quantized: quantized,
            decompressMatrix: decompressMatrix
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
        best = oct = octEncodeNormalFromArray(array, i, "floor", "floor");
        dec = octDecodeVec2(oct);
        currentCos = bestCos = dot(array, i, dec);
        oct = octEncodeNormalFromArray(array, i, "ceil", "floor");
        dec = octDecodeVec2(oct);
        currentCos = dot(array, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeNormalFromArray(array, i, "floor", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(array, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeNormalFromArray(array, i, "ceil", "ceil");
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
function octEncodeNormalFromArray(array: FloatArrayType, i: number, xfunc: any, yfunc: any): Int8Array { // Oct-encode single normal vector in 2 bytes
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
export function decompressUV(uv: FloatArrayType, decompressMatrix: FloatArrayType, dest = new Float32Array(2)) {
    dest[0] = uv[0] * decompressMatrix[0] + decompressMatrix[6];
    dest[1] = uv[1] * decompressMatrix[4] + decompressMatrix[7];
}

/**
 *
 */
export function decompressUVs(uvs: FloatArrayType, decompressMatrix: FloatArrayType, dest = new Float32Array(uvs.length)) {
    for (let i = 0, len = uvs.length; i < len; i += 3) {
        dest[i + 0] = uvs[i + 0] * decompressMatrix[0] + decompressMatrix[6];
        dest[i + 1] = uvs[i + 1] * decompressMatrix[4] + decompressMatrix[7];
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
function octDecodeVec2(oct: Int8Array, result: FloatArrayType = vec3()): FloatArrayType {
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
function octDecodeVec2s(octs: Int8Array, result: FloatArrayType): FloatArrayType {
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
 * @private
 */
export function quantizePositions(positions: FloatArrayType, aabb: FloatArrayType, positionsDecompressMatrix: FloatArrayType) { // http://cg.postech.ac.kr/research/mesh_comp_mobile/mesh_comp_mobile_conference.pdf
    const lenPositions = positions.length;
    const quantizedPositions = new Uint16Array(lenPositions);
    const xmin = aabb[0];
    const ymin = aabb[1];
    const zmin = aabb[2];
    const xwid = aabb[3] - xmin;
    const ywid = aabb[4] - ymin;
    const zwid = aabb[5] - zmin;
    const maxInt = 65525;
    const xMultiplier = maxInt / xwid;
    const yMultiplier = maxInt / ywid;
    const zMultiplier = maxInt / zwid;
    const verify = (num: number) => num >= 0 ? num : 0;
    for (let i = 0; i < lenPositions; i += 3) {
        quantizedPositions[i + 0] = Math.floor(verify(positions[i + 0] - xmin) * xMultiplier);
        quantizedPositions[i + 1] = Math.floor(verify(positions[i + 1] - ymin) * yMultiplier);
        quantizedPositions[i + 2] = Math.floor(verify(positions[i + 2] - zmin) * zMultiplier);
    }
    identityMat4(translate);
    translationMat4v(aabb, translate);
    identityMat4(scale);
    scalingMat4v([xwid / maxInt, ywid / maxInt, zwid / maxInt], scale);
    mulMat4(translate, scale, positionsDecompressMatrix);
    return quantizedPositions;
}

/**
 * @private
 */
export function transformAndOctEncodeNormals(worldNormalMatrix: FloatArrayType, normals: FloatArrayType, lenNormals: number, compressedNormals: FloatArrayType, lenCompressedNormals: number) {

    function dot(p: FloatArrayType, vec3: FloatArrayType) { // Dot product of a normal in an array against a candidate decoding
        return p[0] * vec3[0] + p[1] * vec3[1] + p[2] * vec3[2];
    }

    // http://jcgt.org/published/0003/02/01/
    let oct, dec, best, currentCos, bestCos;
    let i, ei;
    let localNormal = new Float32Array([0, 0, 0, 0]);
    let worldNormal = new Float32Array([0, 0, 0, 0]);
    for (i = 0; i < lenNormals; i += 3) {
        localNormal[0] = normals[i];
        localNormal[1] = normals[i + 1];
        localNormal[2] = normals[i + 2];

        transformVec3(worldNormalMatrix, localNormal, worldNormal);
        normalizeVec3(worldNormal, worldNormal);

        // Test various combinations of ceil and floor to minimize rounding errors
        best = oct = octEncodeVec3(worldNormal, "floor", "floor");
        dec = octDecodeVec2(oct);
        currentCos = bestCos = dot(worldNormal, dec);
        oct = octEncodeVec3(worldNormal, "ceil", "floor");
        dec = octDecodeVec2(oct);
        currentCos = dot(worldNormal, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeVec3(worldNormal, "floor", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(worldNormal, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeVec3(worldNormal, "ceil", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(worldNormal, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        compressedNormals[lenCompressedNormals + i + 0] = best[0];
        compressedNormals[lenCompressedNormals + i + 1] = best[1];
        compressedNormals[lenCompressedNormals + i + 2] = 0.0; // Unused
    }
    lenCompressedNormals += lenNormals;
    return lenCompressedNormals;
}

/**
 * @private
 */
export function octEncodeNormals(normals: FloatArrayType) { // http://jcgt.org/published/0003/02/01/
    const lenNormals = normals.length;
    const compressedNormals = new Int8Array(lenNormals)
    let oct, dec, best, currentCos, bestCos;
    for (let i = 0; i < lenNormals; i += 3) {
        // Test various combinations of ceil and floor to minimize rounding errors
        best = oct = octEncodeNormal(normals, i, "floor", "floor");
        dec = octDecodeVec2(oct);
        currentCos = bestCos = dot(normals, i, dec);
        oct = octEncodeNormal(normals, i, "ceil", "floor");
        dec = octDecodeVec2(oct);
        currentCos = dot(normals, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeNormal(normals, i, "floor", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(normals, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeNormal(normals, i, "ceil", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(normals, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        compressedNormals[i + 0] = best[0];
        compressedNormals[i + 1] = best[1];
        compressedNormals[i + 2] = 0.0; // Unused
    }
    return compressedNormals;
}

/**
 * @private
 */
export function octEncodeVec3(p: FloatArrayType, xfunc: string, yfunc: string): Int8Array { // Oct-encode single normal vector in 2 bytes
    let x = p[0] / (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]));
    let y = p[1] / (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]));
    if (p[2] < 0) {
        let tempx = x;
        let tempy = y;
        tempx = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
        tempy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
        x = tempx;
        y = tempy;
    }
    // @ts-ignore
    return new Int8Array([Math[xfunc](x * 127.5 + (x < 0 ? -1 : 0)), Math[yfunc](y * 127.5 + (y < 0 ? -1 : 0))]);
}

/**
 * @private
 */
export function octEncodeNormal(array: FloatArrayType, i: number, xfunc: string, yfunc: string): Int8Array { // Oct-encode single normal vector in 2 bytes
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


