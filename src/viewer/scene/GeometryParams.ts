import {FloatArrayParam, IntArrayParam} from "../math/math";

/**
 * Non-compressed geometry parameter type for {@link SceneModel.createGeometry}.
 *
 * There are two ways we can use this parameter type:
 *
 * 1. Create geometry using {@link SceneModel.createGeometry}, which will compress the geometry internally for us using {@link compressGeometryParams}
 * 2. Use {@link compressGeometryParams} ourselves, to convert to {@link GeometryParamsCompressed}, then create the geometry using {@link SceneModel.createGeometryCompressed}.
 */
export interface GeometryParams {

    /**
     * RTC origin for the geometry.
     */
    origin: FloatArrayParam;

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
     * Flat array of uncompressed floating point 3D vertex positions.
     *
     * Alternative to {@link GeometryParams.positionsCompressed}.
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
     * Alternative to {@link GeometryParams.colorsCompressed}.
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
     * Ignored when {@link GeometryParams.edgeIndices} is defined.
     */
    edgeThreshold?: number;
}