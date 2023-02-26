import type {FloatArrayParam} from "@xeokit/math/math";
import type {GeometryBucket} from "./GeometryBucket";
import type {RendererGeometry} from "./RendererGeometry";

/**
 * Represents an element of reusable geometry.
 *
 * * Stored in {@link @xeokit/core/components!SceneModel.geometries | SceneModel.geometries}
 * * Created with {@link @xeokit/core/components!SceneModel.createGeometry | SceneModel.createGeometry}
 * and {@link @xeokit/core/components!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * * Referenced by {@link @xeokit/core/components!SceneObject.geometry}
 *
 * See usage in:
 *
 * * [@xeokit/scratchmodel](/docs/modules/_xeokit_scratchmodel.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 * * [@xeokit/xkt](/docs/modules/_xeokit_xkt.html)
 */
export interface Geometry {

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
     * The origin of the geometry's 3D relative-to-center (RTC) coordinate system.
     *
     * Assumed to be ````[0,0,0]```` by default.
     */
    origin?: FloatArrayParam;

    /**
     * Matrix to decompress {@link @xeokit/core/components!GeometryBucketParams.positionsCompressed}.
     *
     * The Viewer uses this matrix internally to decompress (dequantize) {@link @xeokit/core/components!GeometryBucketParams.positionsCompressed}
     * back to 32-bit floating-point relative-to-center (RTC) coordinates that are relative
     * to {@link @xeokit/core/components!Geometry.origin}.
     */
    positionsDecompressMatrix: FloatArrayParam;

    /**
     * Axis-aligned, non-quantized 3D boundary of the geometry's vertex positions.
     *
     * The boundary coordinates are relative to {@link @xeokit/core/components!Geometry.origin}.
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
    geometryBuckets: GeometryBucket[];

    /**
     * Interface through which this Geometry can load any user-updated geometry arrays into the renderer.
     *
     * @internal
     */
    rendererGeometry? : RendererGeometry;
}

