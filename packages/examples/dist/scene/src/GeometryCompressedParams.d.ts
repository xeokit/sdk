import type { FloatArrayParam } from "@xeokit/math";
import type { GeometryBucketParams } from "./GeometryBucketParams";
/**
 * Pre-compressed geometry creation parameters for {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}.
 *
 * ## Summary
 *
 * * Created from {@link @xeokit/scene!GeometryParams|GeometryParams} using {@link @xeokit/compression!compressGeometryParams}
 * * Used with {@link SceneModel.createGeometryCompressed | Model.createGeometryCompressed} and {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * * Simplifies geometry by combining duplicate positions and adjusting indices
 * * Generates edge indices for triangle meshes
 * * Ignores normals (our shaders auto-generate them)
 * * Converts positions to relative-to-center (RTC) coordinates
 * * Quantizes positions and UVs as 16-bit unsigned integers
 * * Splits geometry into {@link @xeokit/scene!GeometryBucketParams | buckets } to enable indices to use the minimum storage bits
 */
export interface GeometryCompressedParams {
    /**
     * ID for the geometry.
     */
    id: string;
    /**
     * Primitive type.
     *
     * Possible values are {@link SolidPrimitive}, {@link SurfacePrimitive}, {@link LinesPrimitive}, {@link PointsPrimitive}
     * and {@link TrianglesPrimitive}.
     */
    primitive: number;
    /**
     * Matrix to decompress {@link @xeokit/scene!GeometryBucketParams.positionsCompressed}.
     *
     * The Viewer uses this matrix internally to decompress {@link @xeokit/scene!GeometryBucketParams.positionsCompressed}.
     */
    positionsDecompressMatrix: FloatArrayParam;
    /**
     * Axis-aligned, non-quantized 3D boundary of the geometry's vertex positions.
     */
    aabb?: FloatArrayParam;
    /**
     * 4x4 matrix to de-quantize the geometry's UV coordinates, when UVs are provided.
     */
    uvsDecompressMatrix?: FloatArrayParam;
    /**
     * The geometry arrays, organized into buckets for optimal memory use.
     *
     * The bucketing strategy aims to reduce memory consumed by indices. There are three buckets, each with an indices array that
     * requires a different number of bits for its values. The first bucket's indices contain 8-bit values in range [0...255],
     * the second contains 16-bit values in range ````[256..65535]````, and the third contains 32-bit values in
     * range ````[65536...2147483647]````. With this strategy, we avoid wasting storage bits on the 8-bit and 16-bit values.
     *
     * The buckets also partition the geometry positions and UVs, so that the indices are indexing positions and UVs
     * that are local to their bucket. This further optimizes memory use, by reducing the values of large indices to small
     * locally-offset values, which can reduce the number of bits they need.
     */
    geometryBuckets: GeometryBucketParams[];
}
