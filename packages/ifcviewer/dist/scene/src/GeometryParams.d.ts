import type { FloatArrayParam, IntArrayParam } from "@xeokit/math";
/**
 * Non-compressed geometry parameters for {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry}.
 *
 * ## Summary
 *
 * * Contains uncompressed, human-readable geometry parameters for {@link @xeokit/scene!SceneModel.createGeometry|SceneModel.createGeometry}
 * * Use {@link @xeokit/scene!compressGeometryParams} to compress {@link @xeokit/scene!GeometryCompressedParams|GeometryCompressedParams}
 * for {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
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
     * Accepted values are {@link @xeokit/constants!SolidPrimitive}, {@link @xeokit/constants!SurfacePrimitive},
     * {@link @xeokit/constants!LinesPrimitive}, {@link @xeokit/constants!PointsPrimitive}
     * and {@link @xeokit/constants!TrianglesPrimitive}.
     */
    primitive: number;
    /**
     * Flat array of uncompressed floating point 3D vertex positions.
     */
    positions: FloatArrayParam;
    uvs?: FloatArrayParam;
    /**
     * Flat array of uncompressed floating-point vertex colors.
     */
    colors?: FloatArrayParam;
    /**
     * Flat array of primitive connectivity indices.
     *
     * Ignored for primitive type {@link @xeokit/constants!PointsPrimitive}, which does not need indices.
     */
    indices?: IntArrayParam;
}
