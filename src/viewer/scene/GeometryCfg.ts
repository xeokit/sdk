import {FloatArrayType, IntArrayType} from "../math/math";

/**
 * Geometry creation parameters for {@link SceneModel.createGeometry}.
 */
export interface GeometryCfg {

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
     * Alternative to {@link GeometryCfg.positionsCompressed}.
     */
    positions?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex positions.
     *
     * Alternative to {@link GeometryCfg.positions}.
     *
     * Requires {@link GeometryCfg.positionsDecompressMatrix}.
     */
    positionsCompressed?: FloatArrayType;

    /**
     * Matrix to dequantize {@link GeometryCfg.positionsCompressed}.
     */
    positionsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point 3D vertex normals.
     *
     * Alternative to {@link GeometryCfg.normalsCompressed}.
     */
    normals?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex normals.
     *
     * Alternative to {@link GeometryCfg.normals}.
     */
    normalsCompressed?: FloatArrayType;

    /*
    * Flat array of uncompressed floating-point vertex UV coordinates.
    *
    * Alternative to {@link GeometryCfg.uvsCompressed}.
    */
    uvs?: FloatArrayType;

    /*
    * Flat array of compressed integer vertex UV coordinates.
    *
    * Alternative to {@link GeometryCfg.uvs}.
    *
    * Requires {@link GeometryCfg.uvsDecompressMatrix}.
    */
    uvsCompressed?: FloatArrayType;

    /**
     * Matrix to dequantize {@link GeometryCfg.uvsCompressed}.
     */
    uvsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point vertex colors.
     *
     * Alternative to {@link GeometryCfg.colorsCompressed}.
     */
    colors?: FloatArrayType;

    /**
     * Flat array of compressed integer vertex colors.
     *
     * Alternative to {@link GeometryCfg.colorsCompressed}.
     *
     * Ignored when {@link GeometryCfg.geometryId} is defined.
     */
    colorsCompressed?: FloatArrayType;

    /**
     * Flat array of primitive connectivity indices.
     */
    indices?: IntArrayType;

    /**
     * Flat array of edge connectivity indices.
     */
    edgeIndices?: IntArrayType;

    /**
     * The threshold angle, in degrees, beyond which the deviation in normal directions of each pair of adjacent faces
     * results in an edge being automatically generated between them.
     *
     * Default is 10.
     *
     * Ignored when {@link GeometryCfg.edgeIndices} is defined.
     */
    edgeThreshold?: number;
}