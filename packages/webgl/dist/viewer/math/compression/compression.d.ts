import type { FloatArrayParam } from "../math";
import type { GeometryParams, GeometryCompressedParams } from "../../../viewer/scene/index";
/**
 * Compresses {@link GeometryParams} into {@link GeometryCompressedParams}.
 *
 * * Simplifies geometry by combining duplicate positions and adjusting indices
 * * Generates edge indices for triangle meshes
 * * Ignores normals (our shaders auto-generate them)
 * * Converts positions to relative-to-center (RTC) coordinates
 * * Quantizes positions and UVs as 16-bit unsigned integers
 * * Splits geometry into {@link GeometryBucketParams | buckets } to enable indices to use the minimum bits for storage
 *
 * The GeometryCompressedParams can then be given to {@link SceneModel.createGeometryCompressed}.
 *
 * #### Special Consideration for SolidPrimitive
 *
 * Note that if {@link GeometryParams.primitive} is {@link constants.SolidPrimitive} and {@link GeometryCompressedParams.geometryBuckets}
 * contains more than one {@link GeometryBucketParams}, then {@link GeometryCompressedParams.primitive} will become
 * {@link constants.SurfacePrimitive}, in the assumption that bucketing has split open a closed (solid) triangle mesh, which
 * can therefore no longer be treated as a solid.
 *
 * ### Example 1: Compressing parameters for a small geometry
 *
 * The example below demonstrates compression of {@link GeometryParams} for a simple geometry that only requires a
 * single {@link GeometryBucketParams | bucket }.
 *
 * Note that if the {@link GeometryParams.positions} array was large enough to require some indices to use more than 16 bits
 * for storage, then that's when the bucketing would kick in, to split the mesh into smaller buckets, each with smaller
 * indices that index a subset of the positions.
 *
 * ````javascript
 * import {math, constants} from "@xeokit/webviewer";
 *
 * const compressedGeometry = math.compression.compressGeometry({
 *      id: "myBoxGeometry",
 *      primitive: constants.TrianglesPrimitive,
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
 * The value of ````compressedGeometry```` is:
 *
 * ````javascript
 * {
 *      id: "myBoxGeometry",
 *      primitive: constants.TrianglesPrimitive,
 *      origin: [200,200,200],
 *      positionsDecompressMatrix: [
 *          0.00003052270125906143, 0, 0, 0,
 *          0, 0.00003052270125906143, 0, 0,
 *          0, 0, 0.00003052270125906143, 0,
 *          -1, -1, -1, 1
 *      ],
 *      geometryBuckets: [
 *          {
 *              positionsCompressed: [
 *                  65525, 65525, 65525, 0, 65525, 65525,
 *                  0, 0, 65525, 65525, 0, 65525, 65525,
 *                  0, 0, 65525, 65525, 0, 0, 65525, 0, 0,
 *                  0, 0
 *              ],
 *              indices: [
 *                  0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
 *                  0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
 *                  4, 7, 6, 4, 6, 5
 *              ],
 *              edgeIndices: [
 *                  3, 4, 0, 4, 5, 0, 5, 6,
 *                  0, 6, 1, 1, 6, 7, 1, 7,
 *                  3, 2, 4, 7, 6, 4, 6
 *              ]
 *          }
 *      ]
 * }
 * ````
 *
 * @param geometryParams Uncompressed geometry params.
 * @returns Compressed geometry params.
 */
export declare function compressGeometryParams(geometryParams: GeometryParams): GeometryCompressedParams;
/**
 * Gets the boundary of a flat positions array.
 *
 * @param array
 * @param min
 * @param max
 */
export declare function getPositionsBounds(array: FloatArrayParam, min?: FloatArrayParam, max?: FloatArrayParam): {
    min: FloatArrayParam;
    max: FloatArrayParam;
};
/**
 * Creates a de-quantization matrix from a boundary.
 */
export declare function createPositionsDecompressMatrix(aabb: FloatArrayParam, positionsDecompressMatrix: FloatArrayParam): FloatArrayParam;
/**
 * Compresses a flat positions array
 */
export declare function compressPositions(array: FloatArrayParam, min: FloatArrayParam, max: FloatArrayParam): {
    quantized: Uint16Array;
    decompressMatrix: FloatArrayParam;
};
/**
 * Decompresses a 3D position
 * @param position
 * @param decompressMatrix
 * @param dest
 */
export declare function decompressPosition(position: FloatArrayParam, decompressMatrix: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Decompresses an axis-aligned 3D boundary
 * @param aabb
 * @param decompressMatrix
 * @param dest
 */
export declare function decompressAABB(aabb: FloatArrayParam, decompressMatrix: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Decompresses a flat array of positions
 * @param positions
 * @param decompressMatrix
 * @param dest
 */
export declare function decompressPositions(positions: FloatArrayParam, decompressMatrix: FloatArrayParam, dest?: Float32Array): Float32Array;
/**
 * Gets the 2D min/max boundary of a flat array of UV coordinate
 * @param array
 */
export declare function getUVBounds(array: FloatArrayParam): {
    min: FloatArrayParam;
    max: FloatArrayParam;
};
/**
 * Compresses a flat array of UV coordinates
 */
export declare var compressUVs: (array: FloatArrayParam, min: FloatArrayParam, max: FloatArrayParam) => {
    quantized: Uint16Array;
    decompressMatrix: FloatArrayParam | Float64Array;
};
/**
 * Oct-encodes a flat array of normal vectors
 * @param array
 */
export declare function compressNormals(array: FloatArrayParam): Int8Array;
/**
 */
export declare function decompressUV(uv: FloatArrayParam, decompressMatrix: FloatArrayParam, dest?: Float32Array): void;
/**
 *
 */
export declare function decompressUVs(uvs: FloatArrayParam, decompressMatrix: FloatArrayParam, dest?: Float32Array): Float32Array;
/**
 *
 */
export declare function decompressNormal(oct: FloatArrayParam, result: FloatArrayParam): FloatArrayParam;
/**
 *
 */
export declare function decompressNormals(octs: string | any[], result: FloatArrayParam): FloatArrayParam;
/**
 * @private
 */
export declare function quantizePositions(positions: FloatArrayParam, aabb: FloatArrayParam, positionsDecompressMatrix: FloatArrayParam): Uint16Array;
/**
 * @private
 */
export declare function transformAndOctEncodeNormals(worldNormalMatrix: FloatArrayParam, normals: FloatArrayParam, lenNormals: number, compressedNormals: FloatArrayParam, lenCompressedNormals: number): number;
/**
 * @private
 */
export declare function octEncodeNormals(normals: FloatArrayParam): Int8Array;
/**
 * @private
 */
export declare function octEncodeVec3(p: FloatArrayParam, xfunc: string, yfunc: string): Int8Array;
/**
 * @private
 */
export declare function octEncodeNormal(array: FloatArrayParam, i: number, xfunc: string, yfunc: string): Int8Array;
