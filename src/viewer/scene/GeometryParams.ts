import {FloatArrayType, IntArrayType} from "../math/math";

/**
 * Geometry creation parameters for {@link SceneModel.createGeometry}.
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
    primitive?: number;

    /**
     * Flat array of uncompressed floating point 3D vertex positions.
     *
     * Alternative to {@link GeometryParams.positionsCompressed}.
     */
    positions?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex positions.
     *
     * Alternative to {@link GeometryParams.positions}.
     *
     * Requires {@link GeometryParams.positionsDecompressMatrix}.
     */
    positionsCompressed?: FloatArrayType;

    /**
     * Matrix to dequantize {@link GeometryParams.positionsCompressed}.
     */
    positionsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point 3D vertex normals.
     *
     * Alternative to {@link GeometryParams.normalsCompressed}.
     */
    normals?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex normals.
     *
     * Alternative to {@link GeometryParams.normals}.
     */
    normalsCompressed?: FloatArrayType;

    /*
    * Flat array of uncompressed floating-point vertex UV coordinates.
    *
    * Alternative to {@link GeometryParams.uvsCompressed}.
    */
    uvs?: FloatArrayType;

    /*
    * Flat array of compressed integer vertex UV coordinates.
    *
    * Alternative to {@link GeometryParams.uvs}.
    *
    * Requires {@link GeometryParams.uvsDecompressMatrix}.
    */
    uvsCompressed?: FloatArrayType;

    /**
     * Matrix to dequantize {@link GeometryParams.uvsCompressed}.
     */
    uvsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point vertex colors.
     *
     * Alternative to {@link GeometryParams.colorsCompressed}.
     */
    colors?: FloatArrayType;

    /**
     * Flat array of compressed integer vertex colors.
     *
     * Alternative to {@link GeometryParams.colorsCompressed}.
     *
     * Ignored when {@link GeometryParams.geometryId} is defined.
     */
    colorsCompressed?: FloatArrayType;

    /**
     * Flat array of primitive connectivity indices.
     *
     * Ignored for primitive type {@link PointsPrimitive}, which does not need indices.
     */
    indices?: IntArrayType;

    /**
     * Flat array of edge connectivity indices.
     *
     * Optionally provided for primitive types {@link SurfacePrimitive}, {@link SolidPrimitive} and {@link TrianglesPrimitive}.
     */
    edgeIndices?: IntArrayType;

    /**
     * The threshold angle, in degrees, beyond which the deviation in normal directions of each pair of adjacent faces
     * results in an edge being automatically generated between them.
     *
     * Only works for primitive types {@link SolidPrimitive}, {@link SurfacePrimitive} and {@link TrianglesPrimitive}.
     *
     * Default is 10.
     *
     * Ignored when {@link GeometryParams.edgeIndices} is defined.
     */
    edgeThreshold?: number;
}