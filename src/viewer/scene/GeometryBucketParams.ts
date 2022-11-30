import {IntArrayParam} from "../math/math";

/**
 * A geometry bucket within {@link GeometryCompressedParams.geometryBuckets}.
 */
export interface GeometryBucketParams {

    /**
     * GeometryBucketHandle bucket's 3D vertex positions, quantized as 16-bit integers.
     *
     * Internally, the Viewer de-quantizes these with {@link GeometryCompressedParams.positionsDecompressMatrix}.
     *
     * Vertex positions are required for all primitive types.
     */
    positionsCompressed: IntArrayParam,

    /**
     * GeometryBucketHandle bucket's UV coordinates, quantized as 16-bit integers.
     *
     * Internally, the Viewer de-quantizes these with {@link GeometryCompressedParams.uvsDecompressMatrix}.
     */
    uvsCompressed?: IntArrayParam,

    /**
     * GeometryBucketHandle bucket's vertex RGB colors, quantized as 8-bit integers.
     */
    colorsCompressed?: IntArrayParam;

    /**
     * GeometryBucketHandle bucket's primitive indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    indices?: IntArrayParam,

    /**
     * GeometryBucketHandle bucket's edge indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    edgeIndices?: IntArrayParam
}