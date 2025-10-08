import {createAABB3} from "../boundaries";
import type {FloatArrayParam} from "../math";
import type {IntArrayParam} from "../math";
import type {SceneGeometryRendererProxy} from "./SceneGeometryRendererProxy";
import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import {SceneModel} from "./SceneModel";

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
   * The SceneModel that contains this SceneGeometry.
   */
  model: SceneModel;

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
  sceneGeometryRendererProxy: SceneGeometryRendererProxy | null;

  /**
   * The count of {@link SceneMesh | SceneMeshes} that reference this SceneGeometry.
   */
  numMeshes: number;

  constructor(model:SceneModel, params: SceneGeometryCompressedParams) {
    this.model = model;
    this.id = params.id;
    this.primitive = params.primitive;
    this.positionsCompressed = params.positionsCompressed;
    this.uvsCompressed = params.uvsCompressed;
    this.colorsCompressed = params.colorsCompressed;
    this.indices = params.indices;
    this.edgeIndices = params.edgeIndices;
    this.aabb = params.aabb ? params.aabb.slice() : createAABB3();
    this.numMeshes = 0;
  }

  update(params: Partial<SceneGeometryCompressedParams>): void {
    let changed = false;

    const p = params;

    if (p.primitive !== undefined && this.primitive !== p.primitive) {
      this.primitive = p.primitive;
      changed = true;
    }

    if (p.positionsCompressed && this.positionsCompressed !== p.positionsCompressed) {
      this.positionsCompressed = p.positionsCompressed;
      changed = true;
    }

    if (p.uvsCompressed && this.uvsCompressed !== p.uvsCompressed) {
      this.uvsCompressed = p.uvsCompressed;
      changed = true;
    }

    if (p.colorsCompressed && this.colorsCompressed !== p.colorsCompressed) {
      this.colorsCompressed = p.colorsCompressed;
      changed = true;
    }

    if (p.indices && this.indices !== p.indices) {
      this.indices = p.indices;
      changed = true;
    }

    if (p.edgeIndices && this.edgeIndices !== p.edgeIndices) {
      this.edgeIndices = p.edgeIndices;
      changed = true;
    }

    if (p.aabb && this.aabb !== p.aabb) {
      this.aabb = p.aabb;
      changed = true;
    }

    if (changed) {
      const scene = this.model.scene;
      scene.onGeometryUpdated.dispatch(scene, this);
    }
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

  /**
   * Destroys this SceneGeometry.
   */
  destroy() {
    this.model._destroyGeometry(this);
  }
}
