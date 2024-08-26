/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/compression/badge)](https://www.jsdelivr.com/package/npm/@xeokit/compression)
 *
 * <img style="padding:20px" src="media://images/geometry_icon.png"/>
 *
 * # xeokit SceneGeometry Compression / Decompression Utilities
 *
 * ---
 *
 * ### *Tools for geometry compression and decompression*
 *
 * ---
 *
 * The xeokit SceneGeometry Compression/Decompression Utilities library provides functions used internally within
 * {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry} implementations to compress geometry. These functions are also
 * provided for users who want to pre-compress their geometry "offline" and then
 * use {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * to create compressed geometry directly.
 *
 * The compression techniques used include simplifying geometry by combining duplicate positions and adjusting indices, generating edge
 * indices for triangle meshes, ignoring normals (as shaders auto-generate them), converting positions to relative-to-center (RTC)
 * coordinates, and quantizing positions and UVs as 16-bit unsigned integers.
 *
 * An example usage includes compressing a SceneGeometryParams into a {@link @xeokit/scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams} using the
 * {@link @xeokit/scene!compressGeometryParams | compressGeometryParams} function.
 *
 * The resulting SceneGeometryCompressedParams object shows vertex positions relative to the origin
 * and quantized to 16-bit integers, duplicate positions removed, and adjusted indices. Additionally, edge indices are
 * generated for the {@link @xeokit/constants!TrianglesPrimitive}, and a positionsDecompressMatrix is included to de-quantize
 * the positions within the Viewer.
 *
 * This library provides a set of functions that are used internally within
 * {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry} implementations to
 * compress geometry. The functions are provided here in case users instead want to pre-compress their geometry "offline",
 * and then use {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * to create the compressed geometry directly.
 *
 * ### Compression Techniques Used
 *
 * * Simplifies geometry by combining duplicate positions and adjusting indices
 * * Generates edge indices for triangle meshes
 * * Ignores normals (our shaders auto-generate them)
 * * Converts positions to relative-to-center (RTC) coordinates
 * * Quantizes positions and UVs as 16-bit unsigned integers
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/compression
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll use {@link @xeokit/scene!compressGeometryParams | compressGeometryParams} to compress
 * a {@link @xeokit/scene!SceneGeometryParams | SceneGeometryParams} into a
 * {@link @xeokit/scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
 *
 * ````javascript
 * import {compressGeometryParams} from "@xeokit/compression";
 * import {TrianglesPrimitive} from "@xeokit/constants";
 *
 * const geometryCompressedParams = compressGeometryParams({
 *      id: "myBoxGeometry",
 *      primitive: TrianglesPrimitive,
 *      positions: [
 *          202, 202, 202, 200, 202, 202,
 *          200, 200, 202, 202, 200, 202,
 *          202, 202, 202, 202, 200, 202,
 *          202, 200, 200, 202, 202, 200,
 *          202, 202, 202, 202, 202, 200,
 *          200, 202, 200, 200, 202, 202,
 *          200, 202, 202, 200, 202, 200,
 *          200, 200, 200, 200, 200, 202,
 *          200, 200, 200, 202, 200, 200,
 *          202, 200, 202, 200, 200, 202,
 *          202, 200, 200, 200, 200, 200,
 *          200, 202, 200, 202, 202, 200
 *      ],
 *      indices: [
 *          0, 1, 2, 0, 2, 3, 4, 5, 6, 4,
 *          6, 7, 8, 9, 10, 8, 10, 11, 12,
 *          13, 14, 12, 14, 15, 16, 17, 18,
 *          16, 18, 19, 20, 21, 22, 20, 22, 23
 *      ]
 *  });
 * ````
 *
 * The value of our new {@link @xeokit/scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams} is shown below.
 *
 * We can see that:
 *
 * * Vertex positions are now relative to ````origin```` and quantized to 16-bit integers
 * * Duplicate positions are removed and indices adjusted
 * * Edge indices generated for our TrianglesPrimitive
 * * A positions 3D boundary ````aabb````, to de-quantize the positions within the Viewer
 *
 * ````javascript
 * {
 *      id: "myBoxGeometry",
 *      primitive: TrianglesPrimitive,
 *      aabb: [200, 200, 200, 202, 202, 202],
 *      positionsCompressed: [
 *         65525, 65525, 65525, 0, 65525, 65525,
 *         0, 0, 65525, 65525, 0, 65525, 65525,
 *         0, 0, 65525, 65525, 0, 0, 65525, 0, 0,
 *         0, 0
 *      ],
 *      origin: [0,0,0],
 *      indices: [
 *         0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
 *         0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
 *         4, 7, 6, 4, 6, 5
 *      ],
 *      edgeIndices: [
 *         3, 4, 0, 4, 5, 0, 5, 6,
 *         0, 6, 1, 1, 6, 7, 1, 7,
 *         3, 2, 4, 7, 6, 4, 6
 *      ]
 * }
 * ````
 *
 * In the next example, we'll again use {@link @xeokit/scene!compressGeometryParams | compressGeometryParams} to compress
 * a {@link @xeokit/scene!SceneGeometryParams | SceneGeometryParams} into a
 * {@link @xeokit/scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams}, which we'll then use to
 * create a compressed geometry within a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {TrianglesPrimitive} from "@xeokit/constants";
 * import {compressGeometryParams} from "@xeokit/compression";
 *
 * const scene = new Scene();
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * const geometryCompressedParams = compressGeometryParams({
 *      id: "myBoxGeometry",
 *      primitive: TrianglesPrimitive,
 *      positions: [202, 202, 202, 200, 202, 202, ...],
 *      indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, ...]
 * });
 *
 * sceneModel.createGeometryCompressed(geometryCompressedParams);
 *
 * sceneModel.createLayerMesh({ id: "myMesh", geometryId: "myGeometry" });
 *
 * sceneModel.createObject({ id: "myObject1", meshIds: ["myMesh"] });
 * sceneModel.createObject({ id: "myObject2", meshIds: ["myMesh"] });
 *
 * sceneModel.build();
 * ````
 *
 * @module @xeokit/compression
 */

import {
    createMat3,
    createMat4,
    createVec3,
    identityMat3,
    identityMat4,
    mulMat3,
    mulMat4,
    normalizeVec3,
    scalingMat3v,
    scalingMat4v,
    transformVec3,
    translationMat3v,
    translationMat4v
} from "@xeokit/matrix";

import type {FloatArrayParam} from "@xeokit/math";

const translate = createMat4();
const scale = createMat4();

/**
 * Gets the boundary of a flat positions array.
 *
 * @param array
 * @param min
 * @param max
 */
export function getPositions3MinMax(array: FloatArrayParam, min?: FloatArrayParam, max?: FloatArrayParam) {
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
 * Creates a de-quantization matrix from a boundary.
 */
export function createPositions3DecompressMat4(aabb: FloatArrayParam, positionsDecompressMatrix?: FloatArrayParam): FloatArrayParam {
    positionsDecompressMatrix = positionsDecompressMatrix || createMat4();
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
export function compressPositions3(array: FloatArrayParam, min: FloatArrayParam, max: FloatArrayParam) {
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
 * Compresses a 3D position
 * @param p
 * @param aabb
 * @param dest
 */
export function compressPoint3WithAABB3(p: FloatArrayParam, aabb: FloatArrayParam, dest: FloatArrayParam = p) {
    const multiplier = new Float32Array([
        aabb[3] !== aabb[0] ? 65535 / (aabb[3] - aabb[0]) : 0,
        aabb[4] !== aabb[1] ? 65535 / (aabb[4] - aabb[1]) : 0,
        aabb[5] !== aabb[2] ? 65535 / (aabb[5] - aabb[2]) : 0
    ]);
    dest[0] = Math.max(0, Math.min(65535, Math.floor((p[0] - aabb[0]) * multiplier[0])));
    dest[1] = Math.max(0, Math.min(65535, Math.floor((p[1] - aabb[1]) * multiplier[1])));
    dest[2] = Math.max(0, Math.min(65535, Math.floor((p[2] - aabb[2]) * multiplier[2])));
    return dest;
}

/**
 * Decompresses a 3D position
 * @param position
 * @param decompressMatrix
 * @param dest
 */
export function decompressPoint3WithMat4(position: FloatArrayParam, decompressMatrix: FloatArrayParam, dest: FloatArrayParam = position): FloatArrayParam {
    dest[0] = position[0] * decompressMatrix[0] + decompressMatrix[12];
    dest[1] = position[1] * decompressMatrix[5] + decompressMatrix[13];
    dest[2] = position[2] * decompressMatrix[10] + decompressMatrix[14];
    return dest;
}

/**
 * Decompresses a 3D position
 * @param position
 * @param aabb
 * @param dest
 */
export function decompressPoint3WithAABB3(position: FloatArrayParam, aabb: FloatArrayParam, dest: FloatArrayParam = position): FloatArrayParam {
    const xScale = (aabb[3] - aabb[0]) / 65535;
    const xOffset = aabb[0];
    const yScale = (aabb[4] - aabb[1]) / 65535;
    const yOffset = aabb[1];
    const zScale = (aabb[5] - aabb[2]) / 65535;
    const zOffset = aabb[2];

    dest[0] = position[0] * xScale + xOffset;
    dest[1] = position[1] * yScale + yOffset;
    dest[2] = position[2] * zScale + zOffset;
    return dest;
}

/**
 * Decompresses an axis-aligned 3D boundary
 * @param aabb
 * @param decompressMatrix
 * @param dest
 */
export function decompressAABB3WithMat4(aabb: FloatArrayParam, decompressMatrix: FloatArrayParam, dest: FloatArrayParam = aabb): FloatArrayParam {
    dest[0] = aabb[0] * decompressMatrix[0] + decompressMatrix[12];
    dest[1] = aabb[1] * decompressMatrix[5] + decompressMatrix[13];
    dest[2] = aabb[2] * decompressMatrix[10] + decompressMatrix[14];
    dest[3] = aabb[3] * decompressMatrix[0] + decompressMatrix[12];
    dest[4] = aabb[4] * decompressMatrix[5] + decompressMatrix[13];
    dest[5] = aabb[5] * decompressMatrix[10] + decompressMatrix[14];
    return dest;
}

/**
 * Decompresses an axis-aligned 3D boundary
 * @param aabb
 * @param aabb2
 * @param dest
 */
export function decompressAABB3WithAABB3(aabb: FloatArrayParam, aabb2: FloatArrayParam, dest: FloatArrayParam = aabb): FloatArrayParam {
    const xScale = (aabb2[3] - aabb2[0]) / 65535;
    const xOffset = aabb2[0];
    const yScale = (aabb2[4] - aabb2[1]) / 65535;
    const yOffset = aabb2[1];
    const zScale = (aabb2[5] - aabb2[2]) / 65535;
    const zOffset = aabb2[2];
    dest[0] = aabb[0] * xScale + xOffset;
    dest[1] = aabb[1] * yScale + yOffset;
    dest[2] = aabb[2] * zScale + zOffset;
    dest[3] = aabb[3] * xScale + xOffset;
    dest[4] = aabb[4] * yScale + yOffset;
    dest[5] = aabb[5] * zScale + zOffset;
    return dest;
}

/**
 * Decompresses a flat array of positions
 * @param positions
 * @param decompressMatrix
 * @param dest
 */
export function decompressPositions3WithMat4(positions: FloatArrayParam, decompressMatrix: FloatArrayParam, dest: Float32Array = new Float32Array(positions.length)): Float32Array {
    for (let i = 0, len = positions.length; i < len; i += 3) {
        dest[i + 0] = positions[i + 0] * decompressMatrix[0] + decompressMatrix[12];
        dest[i + 1] = positions[i + 1] * decompressMatrix[5] + decompressMatrix[13];
        dest[i + 2] = positions[i + 2] * decompressMatrix[10] + decompressMatrix[14];
    }
    return dest;
}

/**
 * Decompresses a flat array of positions
 * @param positions
 * @param aabb
 * @param dest
 */
export function decompressPositions3WithAABB3(positions: FloatArrayParam, aabb: FloatArrayParam, dest: Float32Array = new Float32Array(positions.length)): Float32Array {
    const xScale = (aabb[3] - aabb[0]) / 65535;
    const xOffset = aabb[0];
    const yScale = (aabb[4] - aabb[1]) / 65535;
    const yOffset = aabb[1];
    const zScale = (aabb[5] - aabb[2]) / 65535;
    const zOffset = aabb[2];
    for (let i = 0, len = positions.length; i < len; i += 3) {
        dest[i + 0] = positions[i + 0] * xScale + xOffset;
        dest[i + 1] = positions[i + 1] * yScale + yOffset;
        dest[i + 2] = positions[i + 2] * zScale + zOffset;
    }
    return dest;
}

/**
 * Gets the 2D min/max boundary of a flat array of UV coordinate
 * @param array
 */
export function getUVBounds(array: FloatArrayParam): { min: FloatArrayParam, max: FloatArrayParam } {
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
    const translate = createMat3();
    const scale = createMat3();
    return function (array: FloatArrayParam, min: FloatArrayParam, max: FloatArrayParam): {
        quantized: Uint16Array,
        decompressMatrix: FloatArrayParam | Float64Array
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
export function compressNormals(array: FloatArrayParam): Int8Array { // http://jcgt.org/published/0003/02/01/

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
function octEncodeNormalFromArray(array: FloatArrayParam, i: number, xfunc: any, yfunc: any): Int8Array { // Oct-encode single normal vector in 2 bytes
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
function dot(array: FloatArrayParam, i: number, createVec3: FloatArrayParam): number {
    return array[i] * createVec3[0] + array[i + 1] * createVec3[1] + array[i + 2] * createVec3[2];
}

/**
 */
export function decompressUV(uv: FloatArrayParam, decompressMatrix: FloatArrayParam, dest = new Float32Array(2)) {
    dest[0] = uv[0] * decompressMatrix[0] + decompressMatrix[6];
    dest[1] = uv[1] * decompressMatrix[4] + decompressMatrix[7];
}

/**
 *
 */
export function decompressUVs(uvs: FloatArrayParam, decompressMatrix: FloatArrayParam, dest = new Float32Array(uvs.length)) {
    for (let i = 0, len = uvs.length; i < len; i += 3) {
        dest[i + 0] = uvs[i + 0] * decompressMatrix[0] + decompressMatrix[6];
        dest[i + 1] = uvs[i + 1] * decompressMatrix[4] + decompressMatrix[7];
    }
    return dest;
}

/**
 *
 */
export function decompressNormal(oct: FloatArrayParam, result: FloatArrayParam): FloatArrayParam {
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
export function decompressNormals(octs: string | any[], result: FloatArrayParam): FloatArrayParam {
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
function octDecodeVec2(oct: Int8Array, result: FloatArrayParam = createVec3()): FloatArrayParam {
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
function octDecodeVec2s(octs: Int8Array, result: FloatArrayParam): FloatArrayParam {
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
export function quantizePositions3AndCreateMat4(positions: FloatArrayParam, aabb: FloatArrayParam, positionsDecompressMatrix: FloatArrayParam) { // http://cg.postech.ac.kr/research/mesh_comp_mobile/mesh_comp_mobile_conference.pdf
    const lenPositions = positions.length;
    const positionsCompressed = new Uint16Array(lenPositions);
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
        positionsCompressed[i + 0] = Math.floor(verify(positions[i + 0] - xmin) * xMultiplier);
        positionsCompressed[i + 1] = Math.floor(verify(positions[i + 1] - ymin) * yMultiplier);
        positionsCompressed[i + 2] = Math.floor(verify(positions[i + 2] - zmin) * zMultiplier);
    }
    identityMat4(translate);
    translationMat4v(aabb, translate);
    identityMat4(scale);
    scalingMat4v([xwid / maxInt, ywid / maxInt, zwid / maxInt], scale);
    mulMat4(translate, scale, positionsDecompressMatrix);
    return positionsCompressed;
}

/**
 * @private
 */
export function quantizePositions3(positions: FloatArrayParam, aabb: FloatArrayParam) { // http://cg.postech.ac.kr/research/mesh_comp_mobile/mesh_comp_mobile_conference.pdf
    const lenPositions = positions.length;
    const positionsCompressed = new Uint16Array(lenPositions);
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
        positionsCompressed[i + 0] = Math.floor(verify(positions[i + 0] - xmin) * xMultiplier);
        positionsCompressed[i + 1] = Math.floor(verify(positions[i + 1] - ymin) * yMultiplier);
        positionsCompressed[i + 2] = Math.floor(verify(positions[i + 2] - zmin) * zMultiplier);
    }
    return positionsCompressed;
}

/**
 * @private
 */
export function transformAndOctEncodeNormals(worldNormalMatrix: FloatArrayParam, normals: FloatArrayParam, lenNormals: number, compressedNormals: FloatArrayParam, lenCompressedNormals: number) {

    function dot(p: FloatArrayParam, createVec3: FloatArrayParam) { // Dot product of a normal in an array against a candidate decoding
        return p[0] * createVec3[0] + p[1] * createVec3[1] + p[2] * createVec3[2];
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
export function octEncodeNormals(normals: FloatArrayParam) { // http://jcgt.org/published/0003/02/01/
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
export function octEncodeVec3(p: FloatArrayParam, xfunc: string, yfunc: string): Int8Array { // Oct-encode single normal vector in 2 bytes
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
export function octEncodeNormal(array: FloatArrayParam, i: number, xfunc: string, yfunc: string): Int8Array { // Oct-encode single normal vector in 2 bytes
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
 * Compresses a flat array of floatinging point RGB/RGBA colors.
 */
export function compressRGBColors(colors: FloatArrayParam) { // http://cg.postech.ac.kr/research/mesh_comp_mobile/mesh_comp_mobile_conference.pdf
    const lenColors = colors.length;
    const colorsCompressed = new Uint16Array(lenColors);
    for (let i = 0; i < lenColors; i++) {
        colorsCompressed[i + 0] = Math.floor(colors[i] * 255);
    }
    return colorsCompressed;
}

