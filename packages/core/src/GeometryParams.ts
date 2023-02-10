
import type {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";

/**
 * Non-compressed geometry parameters for {@link @xeokit/core/components!BuildableModel.createGeometry|BuildableModel.createGeometry}.
 *
 * ## Summary
 *
 * * Contains uncompressed, human-readible geometry parameters for {@link @xeokit/core/components!BuildableModel.createGeometry|BuildableModel.createGeometry}
 * * Use {@link @xeokit/core/components!GeometryCompressedParams|GeometryCompressedParams} to convert to {@link @xeokit/compression/compressGeometryParams} for {@link @xeokit/core/components!BuildableModel.createGeometryCompressed | BuildableModel.createGeometryCompressed}
 *
 * @typeparam
 */
export interface GeometryParams {

    /**
     * ID for the geometry.
     */
    id: string;

    /**
     * Primitive type.
     *
     * Accepted values are {@link SolidPrimitive}, {@link SurfacePrimitive}, {@link LinesPrimitive}, {@link PointsPrimitive} and {@link TrianglesPrimitive}.
     */
    primitive: number;

    /**
     * RTC origin for {@link @xeokit/core/components!GeometryParams.positions} or {@link @xeokit/core/components!GeometryParams.positionsCompressed}.
     */
    origin?: FloatArrayParam;

    /**
     * Flat array of uncompressed floating point 3D vertex positions.
     *
     * Alternative to {@link @xeokit/core/components!GeometryParams.positionsCompressed}.
     */
    positions: FloatArrayParam;

    /*
    * Flat array of uncompressed floating-point vertex UV coordinates.
    *
    * Alternative to {@link LayerGeometryParams.uvsCompressed}.
    */
    uvs?: FloatArrayParam;

    /**
     * Flat array of uncompressed floating-point vertex colors.
     *
     * Alternative to {@link @xeokit/core/components!GeometryParams.colorsCompressed}.
     */
    colors?: FloatArrayParam;

    /**
     * Flat array of primitive connectivity indices.
     *
     * Ignored for primitive type {@link PointsPrimitive}, which does not need indices.
     */
    indices?: IntArrayParam;

    /**
     * The threshold angle, in degrees, beyond which the deviation in normal directions of each pair of adjacent faces
     * results in an edge being automatically generated between them.
     *
     * Only works for primitive types {@link SolidPrimitive}, {@link SurfacePrimitive} and {@link TrianglesPrimitive}.
     *
     * Default is 10.
     *
     * Ignored when {@link @xeokit/core/components!GeometryParams.edgeIndices} is defined.
     */
    edgeThreshold?: number;
}