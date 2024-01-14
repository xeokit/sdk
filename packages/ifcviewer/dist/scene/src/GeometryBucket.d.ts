import type { IntArrayParam } from "@xeokit/math";
import type { GeometryBucketParams } from "./GeometryBucketParams";
/**
 * A geometry bucket within {@link @xeokit/scene!SceneGeometry.geometryBuckets | SceneGeometry.geometryBuckets}.
 *
 * See usage in:
 *
 * * [@xeokit/scene](/docs/modules/_xeokit_scene.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 */
export declare class GeometryBucket {
    /**
     * SceneGeometryBucket's 3D vertex positions, quantized as 16-bit integers.
     *
     * Internally, the Viewer dequantizes these with {@link @xeokit/scene!SceneGeometry.positionsDecompressMatrix}.
     *
     * Vertex positions are required for all primitive types.
     */
    positionsCompressed: IntArrayParam;
    /**
     * SceneGeometryBucket's UV coordinates, quantized as 16-bit integers.
     *
     * Internally, the Viewer de-quantizes these with {@link @xeokit/scene!SceneGeometry.uvsDecompressMatrix}.
     */
    uvsCompressed?: IntArrayParam;
    /**
     * SceneGeometryBucket's vertex RGB colors, quantized as 8-bit integers.
     */
    colorsCompressed?: IntArrayParam;
    /**
     * SceneGeometryBucket's primitive indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    indices?: IntArrayParam;
    /**
     * SceneGeometryBucket's edge indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    edgeIndices?: IntArrayParam;
    constructor(geometryBucketParams: GeometryBucketParams);
}
