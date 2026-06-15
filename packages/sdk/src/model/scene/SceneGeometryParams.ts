import type {FloatArrayParam, IntArrayParam} from "../../base/math";

/**
 * Non-compressed geometry parameters for {@link SceneModel.createGeometry | SceneModel.createGeometry}.
 *
 * * Contains uncompressed, human-readable geometry parameters for {@link SceneModel.createGeometry | SceneModel.createGeometry}
 * * Use {@link compressGeometryParams | compressGeometryParams} to compress {@link SceneGeometryCompressedParams | SceneGeometryCompressedParams}
 * for {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 *
 * See {@link scene | @xeokit/sdk/model/scene} for usage.
 */
export interface SceneGeometryParams {

  /**
   * ID for the geometry.
   */
  id: string;

  /**
   * Primitive type.
   *
   * Accepted values are {@link base!constants.SolidPrimitive | SolidPrimitive}, {@link base!constants.SurfacePrimitive | SurfacePrimitive},
   * {@link base!constants.LinesPrimitive | LinesPrimitive}, {@link base!constants.PointsPrimitive | PointsPrimitive}
   * and {@link base!constants.TrianglesPrimitive | TrianglesPrimitive}.
   */
  primitive: number;

  /**
   * Flat array of uncompressed floating point 3D vertex positions.
   */
  positions: FloatArrayParam;

  /**
   * Flat array of uncompressed floating-point 3D vertex normals.
   *
   * Optional. When supplied, the renderer uses these for smooth shading;
   * when omitted, the fragment shader derives a flat face normal from
   * position derivatives.
   *
   * Length must equal `positions.length`. Ignored for `LinesPrimitive`
   * and `PointsPrimitive`.
   */
  normals?: FloatArrayParam;

  /*
    * Flat array of uncompressed floating-point vertex UV coordinates.
    */
  uvs?: FloatArrayParam;

  /**
   * Flat array of uncompressed RGBA floating-point vertex colors.
   * Each color is represented as four consecutive floats in the order RGBA,
   * where each component is in the range [0.0, 1.0].
   */
  colors?: FloatArrayParam;

  /**
   * Flat array of compressed integer RGBA vertex colors. This overrides the `colors` parameter.
   * Each color is represented as four consecutive 8-bit unsigned integers in the order RGBA,
   * where each component is in the range [0, 255].
   */
  colorsCompressed?: IntArrayParam;

  /**
   * Flat array of primitive connectivity indices.
   *
   * Ignored for primitive type {@link base!constants.PointsPrimitive | PointsPrimitive}, which does not need indices.
   */
  indices?: IntArrayParam;

  /**
   * Flat array of per-splat scales — 3 floats per splat (the per-axis gaussian
   * std-devs). Only used for {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}.
   */
  scales?: FloatArrayParam;

  /**
   * Flat array of per-splat rotation quaternions — 4 floats per splat, `xyzw`.
   * Only used for {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}.
   */
  rotations?: FloatArrayParam;
}
