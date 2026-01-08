
import type {IntArrayParam} from "../math";
import type {AABB3} from "../math/boundaries";
import type {Mat4, Vec3} from "../math";


/**
 * Pre-compressed geometry creation parameters for {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}.
 *
 * * Created from {@link SceneGeometryParams | SceneGeometryParams} using {@link compressGeometryParams | compressGeometryParams}
 * * Used with {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * * Generates edge indices for triangle meshes
 * * Ignores normals (our shaders auto-generate them)
 * * Quantizes positions and UVs as 16-bit unsigned integers
 *
 * See {@link scene | @xeokit/sdk/scene} for usage.
 */
export interface SceneGeometryCompressedParams {

  /**
   * ID for the geometry.
   */
  id: string;

  /**
   * Primitive type.
   *
   * Possible values are {@link constants!SolidPrimitive | SolidPrimitive}, {@link constants!SurfacePrimitive | SurfacePrimitive},
   * {@link constants!LinesPrimitive | LinesPrimitive}, {@link constants!PointsPrimitive | PointsPrimitive}
   * and {@link constants!TrianglesPrimitive | TrianglesPrimitive}.
   */
  primitive: number;

  /**
   * Axis-aligned, non-quantized 3D boundary of the geometry's vertex positions.
   */
  aabb?: AABB3;

  /**
   * 4x4 matrix to de-quantize the geometry's UV coordinates, when UVs are provided.
   */
  uvsDecompressMatrix?: Mat4;

  /**
   * 3D vertex positions, quantized as 16-bit integers.
   *
   * Internally, the Viewer decompresses thses
   * with {@link SceneGeometryCompressedParams.aabb | SceneGeometryCompressedParams.aabb}.
   *
   * Vertex positions are required for all primitive types.
   */
  positionsCompressed: IntArrayParam,

  /**
   * UV coordinates, quantized as 16-bit integers.
   *
   * Internally, the Viewer de-quantizes these
   * with {@link SceneGeometryCompressedParams.uvsDecompressMatrix | SceneGeometryCompressedParams.uvsDecompressMatrix}.
   */
  uvsCompressed?: IntArrayParam,

  /**
   * vertex RGB colors, quantized as 8-bit integers.
   */
  colorsCompressed?: IntArrayParam;

  /**
   * primitive indices.
   *
   * This is either an array of 8-bit, 16-bit or 32-bit values.
   */
  indices?: IntArrayParam,

  /**
   * edge indices.
   *
   * This is either an array of 8-bit, 16-bit or 32-bit values.
   */
  edgeIndices?: IntArrayParam;

  /**
   * TODO
   */
  origin?: Vec3;
}
