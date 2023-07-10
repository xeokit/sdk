import type { IntArrayParam } from "@xeokit/math";
import type { GeometryBucketParams } from "./GeometryBucketParams";
/**
 * A geometry bucket within {@link @xeokit/scene!Geometry.geometryBuckets | Geometry.geometryBuckets}.
 *
 * See usage in:
 *
 * * [@xeokit/scene](/docs/modules/_xeokit_scene.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 */
export declare class GeometryBucket {
    /**
     * GeometryBucket's 3D vertex positions, quantized as 16-bit integers.
     *
     * Internally, the Viewer dequantizes these with {@link @xeokit/scene!Geometry.positionsDecompressMatrix}.
     *
     * Vertex positions are required for all primitive types.
     */
    positionsCompressed: IntArrayParam;
    /**
     * GeometryBucket's UV coordinates, quantized as 16-bit integers.
     *
     * Internally, the Viewer de-quantizes these with {@link @xeokit/scene!Geometry.uvsDecompressMatrix}.
     */
    uvsCompressed?: IntArrayParam;
    /**
     * GeometryBucket's vertex RGB colors, quantized as 8-bit integers.
     */
    colorsCompressed?: IntArrayParam;
    /**
     * GeometryBucket's primitive indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    indices?: IntArrayParam;
    /**
     * GeometryBucket's edge indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    edgeIndices?: IntArrayParam;
    constructor(geometryBucketParams: GeometryBucketParams);
}
