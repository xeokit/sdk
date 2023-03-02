import {IntArrayParam} from "@xeokit/math/math";
import {GeometryBucketParams} from "./GeometryBucketParams";

/**
 * A geometry bucket within {@link @xeokit/scene!Geometry.geometryBuckets | Geometry.geometryBuckets}.
 *
 * See usage in:
 *
 * * [@xeokit/scene](/docs/modules/_xeokit_scene.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 */
export class GeometryBucket {

    /**
     * GeometryBucketHandle bucket's 3D vertex positions, quantized as 16-bit integers.
     *
     * Internally, the Viewer uses {@link @xeokit/scene!Geometry.positionsDecompressMatrix} to decompress (dequantize)
     * these back to 32-bit floating-point relative-to-center (RTC) positions that are relative to {@link @xeokit/scene!Geometry.origin}.
     *
     * Vertex positions are required for all primitive types.
     */
    positionsCompressed: IntArrayParam;

    /**
     * GeometryBucketHandle bucket's UV coordinates, quantized as 16-bit integers.
     *
     * Internally, the Viewer de-quantizes these with {@link @xeokit/scene!Geometry.uvsDecompressMatrix}.
     */
    uvsCompressed?: IntArrayParam;

    /**
     * GeometryBucketHandle bucket's vertex RGB colors, quantized as 8-bit integers.
     */
    colorsCompressed?: IntArrayParam;

    /**
     * GeometryBucketHandle bucket's primitive indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    indices?: IntArrayParam;

    /**
     * GeometryBucketHandle bucket's edge indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    edgeIndices?: IntArrayParam;

    constructor(geometryBucketParams: GeometryBucketParams) {
        this.positionsCompressed = geometryBucketParams.positionsCompressed;
        this.uvsCompressed = geometryBucketParams.uvsCompressed;
        this.colorsCompressed = geometryBucketParams.colorsCompressed;
        this.indices = geometryBucketParams.indices;
        this.edgeIndices = geometryBucketParams.edgeIndices;
    }
}