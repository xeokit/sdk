
import type {FloatArrayParam, IntArrayParam} from "../../base/math";
import type {AABB3} from "../../base/math/boundaries";
import type {Vec3} from "../../base/math/vector";
import type {Mat4} from "../../base/math/matrix";


/**
 * Pre-compressed geometry creation parameters for {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}.
 *
 * * Created from {@link SceneGeometryParams | SceneGeometryParams} using {@link compressGeometryParams | compressGeometryParams}
 * * Used with {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * * Generates edge indices for triangle meshes
 * * Quantizes positions and UVs as 16-bit unsigned integers
 * * Quantizes normals (when supplied) as octahedral pairs in 16-bit unsigned integers; geometry without
 *   normals continues to render with shader-derived flat normals
 *
 * See {@link scene | @xeokit/sdk/model/scene} for usage.
 */
export interface SceneGeometryCompressedParams {

  /**
   * ID for the geometry.
   */
  id: string;

  /**
   * Primitive type.
   *
   * Possible values are {@link base!constants.SolidPrimitive | SolidPrimitive}, {@link base!constants.SurfacePrimitive | SurfacePrimitive},
   * {@link base!constants.LinesPrimitive | LinesPrimitive}, {@link base!constants.PointsPrimitive | PointsPrimitive}
   * and {@link base!constants.TrianglesPrimitive | TrianglesPrimitive}.
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
   * UV coordinates, packed as 32-bit floats (one `Float32Array` of
   * length `2 × vertexCount`). UVs ship to the GPU uncompressed so
   * tiling values (UVs outside `[0, 1]`) survive intact — the shader
   * applies a per-fragment `fract()` before transforming into the
   * mesh's atlas sub-rect.
   */
  uvsCompressed?: FloatArrayParam,

  /**
   * vertex RGBA colors, quantized as 8-bit integers.
   */
  colorsCompressed?: IntArrayParam;

  /**
   * Vertex normals, octahedral-encoded as pairs of 16-bit unsigned integers.
   *
   * Optional. Two values per vertex: each pair represents the octahedral
   * (x, y) projection of the unit normal, mapped from `[-1, 1]` to
   * `[0, 65535]`. Length must equal `(positionsCompressed.length / 3) * 2`.
   *
   * Geometry without `normalsCompressed` is rendered with shader-derived
   * flat face normals.
   */
  normalsCompressed?: IntArrayParam;

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
   * Per-splat scales — 3 floats per splat. Only used for
   * {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}. Carried uncompressed in P1.
   */
  scales?: FloatArrayParam;

  /**
   * Per-splat rotation quaternions — 4 floats per splat, `xyzw`. Only used for
   * {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}. Carried uncompressed in P1.
   */
  rotations?: FloatArrayParam;

  /**
   * TODO
   */
  origin?: Vec3;
}
