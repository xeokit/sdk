/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/compression/badge)](https://www.jsdelivr.com/package/npm/@xeokit/compression)
 *
 * <img style="padding:20px" src="media://images/geometry_icon.png"/>
 *
 * # xeokit Geometry Compression / Decompression Utilities
 *
 * ---
 *
 * ### *Tools for geometry compression and decompression*
 *
 * ---
 *
 * The xeokit Geometry Compression/Decompression Utilities library provides functions used internally within SceneModel.createGeometry implementations to compress geometry. These functions are also provided for users who want to pre-compress their geometry "offline" and then use SceneModel.createGeometryCompressed to create compressed geometry directly.

 The compression techniques used include simplifying geometry by combining duplicate positions and adjusting indices, generating edge indices for triangle meshes, ignoring normals (as shaders auto-generate them), converting positions to relative-to-center (RTC) coordinates, quantizing positions and UVs as 16-bit unsigned integers, and splitting geometry into buckets to enable indices to use the minimum bits for storage. The bucketing technique was developed for xeokit by Toni Marti with support from Tribia AG.

 To use the library, install it using npm install @xeokit/compression. An example usage includes compressing a GeometryParams into a GeometryCompressedParams using the compressGeometryParams function. In this example, the geometry is simple, and only one bucket is needed. However, if the positions array was large enough to require some indices to use more than 16 bits for storage, the bucketing mechanism would split the geometry into smaller buckets, each with smaller indices that index a subset of the positions.

 The resulting GeometryCompressedParams object shows that we have one bucket with vertex positions relative to the origin and quantized to 16-bit integers, duplicate positions removed, and adjusted indices. Additionally, edge indices are generated for the TrianglesPrimitive, and a positionsDecompressMatrix is included to de-quantize the positions within the Viewer.

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
 * * Splits geometry into {@link @xeokit/scene!GeometryBucketParams | buckets } to enable indices to use the minimum bits for storage
 *
 * ### Aknowledgements
 *
 * * The bucketing technique mentioned above was developed for xeokit by Toni Marti, with support from Tribia AG. Read [the slides](media://pdfs/GPU_RAM_Savings_Toni_Marti_Apr22.pdf) from Toni's presentation at WebGL Meetup 2022.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/compression
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll use {@link @xeokit/scene!compressGeometryParams} to compress
 * a {@link @xeokit/scene!GeometryParams | GeometryParams} into a
 * {@link @xeokit/scene!GeometryCompressedParams | GeometryCompressedParams}.
 *
 * In this example, our geometry is very simple, and our GeometryCompressedParams only gets a single
 * {@link @xeokit/scene!GeometryBucketParams | GeometryBucketParams }. Note that if the
 * {@link @xeokit/scene!GeometryParams.positions | GeometryParams.positions} array was large enough to require
 * some of the indices to use more than 16 bits for storage, then that's when the function's bucketing mechanism would
 * kick in, to split the geometry into smaller buckets, each with smaller indices that index a subset of the positions.
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
 * The value of our new {@link @xeokit/scene!GeometryCompressedParams | GeometryCompressedParams} is shown below.
 *
 * We can see that:
 *
 * * We get one bucket, because we have only a small number of indices
 * * Vertex positions are now relative to ````origin```` and quantized to 16-bit integers
 * * Duplicate positions are removed and indices adjusted
 * * Edge indices generated for our TrianglesPrimitive
 * * A ````positionsDecompressMatrix```` to de-quantize the positions within the Viewer
 *
 * ````javascript
 * {
 *      id: "myBoxGeometry",
 *      primitive: TrianglesPrimitive,
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
 * In the next example, we'll again use {@link @xeokit/scene!compressGeometryParams} to compress
 * a {@link @xeokit/scene!GeometryParams | GeometryParams} into a
 * {@link @xeokit/scene!GeometryCompressedParams | GeometryCompressedParams}, which we'll then use to
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
 * sceneModel.createMesh({ id: "myMesh", geometryId: "myGeometry" });
 *
 * sceneModel.createObject({ id: "myObject1", meshIds: ["myMesh"] });
 * sceneModel.createObject({ id: "myObject2", meshIds: ["myMesh"] });
 *
 * sceneModel.build();
 * ````
 *
 * @module @xeokit/compression
 */
import type { FloatArrayParam } from "@xeokit/math";
/**
 * Gets the boundary of a flat positions array.
 *
 * @param array
 * @param min
 * @param max
 */
export declare function getPositions3MinMax(array: FloatArrayParam, min?: FloatArrayParam, max?: FloatArrayParam): {
    min: FloatArrayParam;
    max: FloatArrayParam;
};
/**
 * Creates a de-quantization matrix from a boundary.
 */
export declare function createPositions3DecompressMat4(aabb: FloatArrayParam, positionsDecompressMatrix: FloatArrayParam): FloatArrayParam;
/**
 * Compresses a flat positions array
 */
export declare function compressPositions3(array: FloatArrayParam, min: FloatArrayParam, max: FloatArrayParam): {
    quantized: Uint16Array;
    decompressMatrix: FloatArrayParam;
};
/**
 * Compresses a 3D position
 * @param p
 * @param aabb
 * @param q
 */
export declare function compressPoint3(p: FloatArrayParam, aabb: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Decompresses a 3D position
 * @param position
 * @param decompressMatrix
 * @param dest
 */
export declare function decompressPoint3(position: FloatArrayParam, decompressMatrix: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Decompresses an axis-aligned 3D boundary
 * @param aabb
 * @param decompressMatrix
 * @param dest
 */
export declare function decompressAABB3(aabb: FloatArrayParam, decompressMatrix: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Decompresses a flat array of positions
 * @param positions
 * @param decompressMatrix
 * @param dest
 */
export declare function decompressPositions3(positions: FloatArrayParam, decompressMatrix: FloatArrayParam, dest?: Float32Array): Float32Array;
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
export declare function quantizePositions3(positions: FloatArrayParam, aabb: FloatArrayParam, positionsDecompressMatrix: FloatArrayParam): Uint16Array;
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
