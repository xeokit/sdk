import {FloatArrayParam} from "../math/index";
import {GeometryBucketParams} from "./GeometryBucketParams";

/**
 * Compressed geometry creation parameter type for {@link SceneModel.createGeometryCompressed}.
 *
 * This parameter type provides geometry data for the {@link SceneModel} builder method
 * {@link SceneModel.createGeometryCompressed}, in a compact format that reduces the amount of memory used for
 * vertex attributes and indices.
 *
 * Use {@link SceneModel.createGeometry} and {@link GeometryParams} to create geometries programmatically, from human-readable
 * arrays that are not yet quantized. Use {@link SceneModel.createGeometryCompressed} and GeometryCompressedParams to
 * create geometries from pre-compressed data.
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
     * RTC origin for the geometry.
     */
    origin?: FloatArrayParam;

    /**
     * 4x4 matrix to de-quantize the geometry's 3D vertex positions.
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
    geometryBuckets: GeometryBucketParams[]
}