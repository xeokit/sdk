
import type {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";

/**
 * Non-compressed geometry parameters for {@link SceneModel.createGeometry | SceneModel.createGeometry}.
 *
 * ## Summary
 *
 * * Contains uncompressed, human-readable geometry parameters for {@link SceneModel.createGeometry|SceneModel.createGeometry}
 * * Use {@link @xeokit/scene!compressGeometryParams} to compress {@link GeometryCompressedParams|GeometryCompressedParams}
 * for {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 *
 * See usage in:
 *
 * * [@xeokit/scene](/docs/modules/_xeokit_scene.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
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
     * Accepted values are {@link @xeokit/core/constants!SolidPrimitive}, {@link @xeokit/core/constants!SurfacePrimitive},
     * {@link @xeokit/core/constants!LinesPrimitive}, {@link @xeokit/core/constants!PointsPrimitive}
     * and {@link @xeokit/core/constants!TrianglesPrimitive}.
     */
    primitive: number;

    /**
     * RTC origin for {@link GeometryParams.positions}.
     */
    origin?: FloatArrayParam;

    /**
     * Flat array of uncompressed floating point 3D vertex positions.
     */
    positions: FloatArrayParam;

    /*
    * Flat array of uncompressed floating-point vertex UV coordinates.
    */
    uvs?: FloatArrayParam;

    /**
     * Flat array of uncompressed floating-point vertex colors.
     */
    colors?: FloatArrayParam;

    /**
     * Flat array of primitive connectivity indices.
     *
     * Ignored for primitive type {@link @xeokit/core/constants!PointsPrimitive}, which does not need indices.
     */
    indices?: IntArrayParam;

    /**
     * The threshold angle, in degrees, beyond which the deviation in normal directions of each pair of adjacent faces
     * results in an edge being automatically generated between them.
     *
     * Only works for primitive types {@link @xeokit/core/constants!SolidPrimitive},
     * {@link @xeokit/core/constants!SurfacePrimitive} and {@link @xeokit/core/constants!TrianglesPrimitive}.
     *
     * Default is 10.
     */
    edgeThreshold?: number;
}