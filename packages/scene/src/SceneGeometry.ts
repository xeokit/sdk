import type {FloatArrayParam} from "@xeokit/math";
import  {SceneGeometryBucket} from "./SceneGeometryBucket";
import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import type {RendererGeometry} from "./RendererGeometry";

/**
 * A geometry in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.geometries | SceneModel.geometries}
 * * Created with {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry}
 * and {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * * Referenced by {@link @xeokit/scene!SceneMesh.geometry | SceneMesh.geometry}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export class SceneGeometry {

    /**
     * ID for the geometry.
     */
    id: string;

    /**
     * Primitive type.
     *
     * Possible values are {@link @xeokit/constants!SolidPrimitive}, {@link @xeokit/constants!SurfacePrimitive},
     * {@link @xeokit/constants!LinesPrimitive}, {@link @xeokit/constants!PointsPrimitive}
     * and {@link @xeokit/constants!TrianglesPrimitive}.
     */
    primitive: number;

    /**
     * Matrix to decompress {@link @xeokit/scene!SceneGeometryBucketParams.positionsCompressed}.
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
    geometryBuckets: SceneGeometryBucket[];

    /**
     * Interface through which this SceneGeometry can load any user-updated geometry arrays into the renderers.
     *
     * @internal
     */
    rendererGeometry: RendererGeometry | null;

    constructor(params: SceneGeometryCompressedParams) {
        this.geometryBuckets = [];
        for (let i = 0, len = params.geometryBuckets.length; i < len; i++) {
            this.geometryBuckets[i] = new SceneGeometryBucket(params.geometryBuckets[i]);
        }
        this.id = params.id;
        this.positionsDecompressMatrix = params.positionsDecompressMatrix;
        this.primitive = params.primitive;
    }

    /**
     * Gets this SceneGeometry as JSON.
     */
    getJSON(): SceneGeometryCompressedParams {
        const geometryParams = <SceneGeometryCompressedParams>{
            id: this.id,
            primitive: this.primitive,
            positionsDecompressMatrix: Array.from(this.positionsDecompressMatrix),
            geometryBuckets: []
        };
        for (let i = 0, len = this.geometryBuckets.length; i < len; i++) {
            const geometryBucket = this.geometryBuckets[i];
            const geometryBucketJSON: any = {};
            if (geometryBucket.positionsCompressed) {
                geometryBucketJSON.positionsCompressed = Array.from(geometryBucket.positionsCompressed);
            }
            if (geometryBucket.uvsCompressed) {
                geometryBucketJSON.uvsCompressed = Array.from(geometryBucket.uvsCompressed);
            }
            if (geometryBucket.colorsCompressed) {
                geometryBucketJSON.colorsCompressed = Array.from(geometryBucket.colorsCompressed);
            }
            if (geometryBucket.indices) {
                geometryBucketJSON.indices = Array.from(geometryBucket.indices);
            }
            if (geometryBucket.edgeIndices) {
                geometryBucketJSON.edgeIndices = Array.from(geometryBucket.edgeIndices);
            }
            geometryParams.geometryBuckets.push(geometryBucketJSON);
        }
        return geometryParams;
    }
}