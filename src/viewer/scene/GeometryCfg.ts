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
     * Primitive type; Accepted values are 'points', 'lines', 'triangles', 'solid' and 'surface'.
     */
    primitive: string;

    /**
     * Optional 3D geometry RTC origin. When given, the coordinates in {@link GeometryCfg.positions} or
     * {@link GeometryCfg.positionsCompressed} will be relative to this origin.
     */
    origin?: FloatArrayType;

    /**
     * Flat array of uncompressed floating point 3D vertex positions. Alternative to {@link GeometryCfg.positionsCompressed}.
     */
    positions?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex positions. Alternative to {@link GeometryCfg.positions}. Requires {@link GeometryCfg.positionsDecompressMatrix}.
     */
    positionsCompressed?: Uint16Array;

    /**
     * Matrix to dequantize {@link GeometryCfg.positionsCompressed}.
     */
    positionsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point 3D vertex normals. Alternative to {@link GeometryCfg.normalsCompressed}.
     */
    normals?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex normals. Alternative to {@link GeometryCfg.normals}.
     */
    normalsCompressed?: Uint8Array;

    /*
    * Flat array of uncompressed floating-point vertex UV coordinates. Alternative to {@link GeometryCfg.uvsCompressed}.
    */
    uvs?: FloatArrayType;

    /*
    * Flat array of compressed integer vertex UV coordinates. Alternative to {@link GeometryCfg.uvs}. Requires {@link GeometryCfg.uvsDecompressMatrix}.
    */
    uvsCompressed?: FloatArrayType;

    uvsDecompressMatrix?: FloatArrayType;
    colors?: FloatArrayType;
    colorsCompressed?: FloatArrayType;
    indices?: IntArrayType;
    edgeIndices?: IntArrayType;
    edgeThreshold?: number;
}