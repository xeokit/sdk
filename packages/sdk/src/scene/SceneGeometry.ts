import { createAABB3 } from "../boundaries";
import type { FloatArrayParam } from "../math";
import { IntArrayParam } from "../math";
import type { RendererGeometry } from "./RendererGeometry";
import type { SceneGeometryCompressedParams } from "./SceneGeometryCompressedParams";

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
  id: string;

  /**
     * Primitive type.
     *
     * Possible values are {@link constants!SolidPrimitive}, {@link constants!SurfacePrimitive},
     * {@link constants!LinesPrimitive}, {@link constants!PointsPrimitive}
     * and {@link constants!TrianglesPrimitive}.
     */
  primitive: number;

  /**
     * Axis-aligned, non-quantized 3D boundary of the geometry's vertex positions.
     */
  aabb?: FloatArrayParam;

  /**
     * 4x4 matrix to de-quantize the geometry's UV coordinates, when UVs are provided.
     */
  uvsDecompressMatrix?: FloatArrayParam;

  /**
     * 3D vertex positions, quantized as 16-bit integers.
     *
     * Internally, the Viewer dequantizes these using {@link SceneGeometry.aabb | SceneGeometry.aabb}, which provides their unquantized 3D boundary.
     *
     * Vertex positions are required for all primitive types.
     */
  positionsCompressed: IntArrayParam;

  /**
     * UV coordinates, quantized as 16-bit integers.
     *
     * Internally, the Viewer de-quantizes these with {@link SceneGeometry.uvsDecompressMatrix | SceneGeometry.uvsDecompressMatrix}.
     */
  uvsCompressed?: IntArrayParam;

  /**
     * Vertex RGB colors, quantized as 8-bit integers.
     */
  colorsCompressed?: IntArrayParam;

  /**
     * primitive indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
  indices?: IntArrayParam;

  /**
     * Edge indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
  edgeIndices?: IntArrayParam;

  /**
     * Interface through which this SceneGeometry can load any user-updated geometry arrays into the renderers.
     *
     * @internal
     */
  rendererGeometry: RendererGeometry | null;

  /**
     * TODO
     */
  origin?:FloatArrayParam;

  /**
     * The count of {@link SceneMesh | SceneMeshes} that reference this SceneGeometry.
     */
  numMeshes: number;

  constructor(params: SceneGeometryCompressedParams) {
    this.id = params.id;
    this.primitive = params.primitive;
    this.positionsCompressed = params.positionsCompressed;
    this.uvsCompressed = params.uvsCompressed;
    this.colorsCompressed = params.colorsCompressed;
    this.indices = params.indices;
    this.edgeIndices = params.edgeIndices;
    this.origin = params.origin;
    this.aabb = params.aabb ? params.aabb.slice() : createAABB3();
    this.numMeshes = 0;
  }

  /**
     * Gets this SceneGeometry as SceneGeometryCompressedParams.
     */
  toParams(): SceneGeometryCompressedParams {
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
    if (this.indices) {
      params.indices = Array.from(this.indices);
    }
    if (this.edgeIndices) {
      params.edgeIndices = Array.from(this.edgeIndices);
    }
    return params;
  }
}
