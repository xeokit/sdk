import {type  AABB3Float32, createAABB3Float32} from "../math/boundaries";
import type {FloatArrayParam, IntArrayParam} from "../math";
import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import {SceneModel} from "./SceneModel";
import {SDKErrorType, type SDKResult} from "../core";
import type {Mat4} from "../math/matrix";

/**
 * A geometry in a {@link SceneModel | SceneModel}.
 *
 * * Contains triangles, lines or points
 * * Stored in {@link SceneModel.geometries | SceneModel.geometries}
 * * Created with {@link SceneModel.createGeometry | SceneModel.createGeometry}
 * or {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * * Referenced by {@link SceneMesh.geometry | SceneMesh.geometry}
 *
 * See {@link scene | @xeokit/sdk/scene}  for usage.
 */
export class SceneGeometry {

  /**
   * ID for the geometry.
   */
  readonly id: string;

  /**
   * The global ID of this SceneGeometry, unique among all SceneGeometrys within the Scene,
   * which is the concatenation of the SceneModel's ID and this SceneGeometry's ID, separated by "__".
   */
  readonly uniqueId: string;

  /**
   * The SceneModel that contains this SceneGeometry.
   */
  readonly model: SceneModel;

  /**
   * Primitive type.
   *
   * Possible values are {@link constants!SolidPrimitive}, {@link constants!SurfacePrimitive},
   * {@link constants!LinesPrimitive}, {@link constants!PointsPrimitive}
   * and {@link constants!TrianglesPrimitive}.
   */
  readonly primitive: number;

  /**
   * Axis-aligned, non-quantized 3D boundary of the geometry's vertex positions.
   */
  readonly aabb?: AABB3Float32;

  /**
   * 4x4 matrix to de-quantize the geometry's UV coordinates, when UVs are provided.
   */
  readonly uvsDecompressMatrix?: Mat4;

  /**
   * 3D vertex positions, quantized as 16-bit integers.
   *
   * Internally, the Viewer dequantizes these using {@link SceneGeometry.aabb | SceneGeometry.aabb}, which provides their unquantized 3D boundary.
   *
   * Vertex positions are required for all primitive types.
   */
  readonly positionsCompressed: IntArrayParam;

  /**
   * UV coordinates, packed as 32-bit floats (one `Float32Array` of
   * length `2 × vertexCount`). UVs ship to the GPU uncompressed so
   * tiling values (UVs outside `[0, 1]`) survive intact — the shader
   * applies a per-fragment `fract()` before transforming into the
   * mesh's atlas sub-rect.
   */
  readonly uvsCompressed?: FloatArrayParam;

  /**
   * Vertex RGBA colors, quantized as 8-bit integers.
   */
  readonly colorsCompressed?: IntArrayParam;

  /**
   * Vertex normals, octahedral-encoded as pairs of 16-bit unsigned integers.
   *
   * When defined, the renderer reads these per-vertex and uses them for
   * smooth shading; when undefined, fragments derive a flat face normal
   * from view-space position derivatives.
   */
  readonly normalsCompressed?: IntArrayParam;

  /**
   * primitive indices.
   *
   * This is either an array of 8-bit, 16-bit or 32-bit values.
   */
  readonly indices?: IntArrayParam;

  /**
   * Edge indices.
   *
   * This is either an array of 8-bit, 16-bit or 32-bit values.
   */
  readonly edgeIndices?: IntArrayParam;

  /**
   * The count of {@link SceneMesh | SceneMeshes} that reference this SceneGeometry.
   */
  numMeshes: number;

  /**
   * True if this SceneGeometry has been destroyed.
   */
  destroyed: boolean = false;

  /**
   * @private
   */
  constructor(model: SceneModel, params: SceneGeometryCompressedParams) {
    this.model = model;
    this.id = params.id;
    this.uniqueId = `${model.id}__${this.id}`;
    this.primitive = params.primitive;
    this.positionsCompressed = params.positionsCompressed;
    this.uvsCompressed = params.uvsCompressed;
    this.colorsCompressed = params.colorsCompressed;
    this.normalsCompressed = params.normalsCompressed;
    this.indices = params.indices;
    this.edgeIndices = params.edgeIndices;
    this.aabb = createAABB3Float32(params.aabb);
    this.numMeshes = 0;
  }

  /**
   * Gets this SceneGeometry as SceneGeometryCompressedParams.
   */
  toParams(): SDKResult<SceneGeometryCompressedParams> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneGeometry.toParams] SceneGeometry already destroyed"
      });
    }
    const params = <SceneGeometryCompressedParams>{
      id: this.id,
      primitive: this.primitive,
      aabb: Array.from(this.aabb),
      positionsCompressed: Array.from(this.positionsCompressed)
    };
    if (this.positionsCompressed) {
      params.positionsCompressed = Array.from(this.positionsCompressed);
    }
    if (this.uvsCompressed) {
      params.uvsCompressed = Array.from(this.uvsCompressed);
    }
    if (this.colorsCompressed) {
      params.colorsCompressed = Array.from(this.colorsCompressed);
    }
    if (this.normalsCompressed) {
      params.normalsCompressed = Array.from(this.normalsCompressed);
    }
    if (this.indices) {
      params.indices = Array.from(this.indices);
    }
    if (this.edgeIndices) {
      params.edgeIndices = Array.from(this.edgeIndices);
    }
    return {
      ok: true,
      value: params
    };
  }

  /**
   * Destroys this SceneGeometry.
   */
  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneGeometry.destroy] SceneGeometry already destroyed"
      });
    }
    if (this.numMeshes > 0) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneGeometry.destroy] Cannot destroy SceneGeometry ${this.id} - SceneGeometry is currently used by at least one SceneMesh, which you need to destroy first`
      });
    }
    this.model._destroyGeometry(this);
    this.destroyed = true;
    return {
      ok: true,
      value: undefined
    };
  }
}
