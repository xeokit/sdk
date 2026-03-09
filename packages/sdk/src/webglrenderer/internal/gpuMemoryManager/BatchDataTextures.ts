import { DataTexture } from "./dataTextures/DataTexture";
import { type PrimRange } from "./dataTextures/PrimRange";
import {PrimitiveMeshIndexTexture} from "./dataTextures/PrimitiveMeshIndexTexture";
import {MeshAttributeTexture} from "./dataTextures/MeshAttributeTexture";
import {MatrixTexture} from "./dataTextures/MatrixTexture";
import {GeometryAttributeTexture} from "./dataTextures/GeometryAttributeTexture";
import {GeometryQuantRangeTexture} from "./dataTextures/GeometryQuantRangeTexture";
import {VertexPositionTexture} from "./dataTextures/VertexPositionTexture";
import {VertexColorTexture} from "./dataTextures/VertexColorTexture";
import {MeshViewAttributeTexture} from "./dataTextures/MeshViewAttributeTexture";
import {IndexTexture} from "./dataTextures/IndexTexture";


/**
 * GPU data textures for a single sorted render batch.
 *
 * A {@link WebGLRenderer} groups renderable meshes into batches that share
 * compatible rendering state in order to minimize draw calls. Each batch owns
 * a set of GPU-resident {@link DataTexture}s containing all data required to
 * render the meshes in that batch.
 *
 * A batch contains:
 * - **Per-view textures**, whose contents may differ by View (camera, picking view, etc.)
 * - **View-invariant textures**, shared across all Views
 *
 * Instances are stored in {@link DataTextures.batches}.
 *
 * @internal
 */
export interface BatchDataTextures {

  /**
   * Per-view data textures for this batch.
   *
   * Each entry corresponds to one View and contains textures whose contents
   * depend on view-specific state such as visibility, selection, or pass filtering.
   */
  views: Array<{

    /**
     * Number of primitives that are drawable for this View.
     *
     * This value defines the valid primitive index range for view-dependent
     * draw lists and is used to bound iteration and validation logic.
     */
    numDrawablePrims: number;

    /**
     * Primitive-to-mesh index table for this View.
     *
     * This texture represents the batch’s draw list: it enumerates all primitives
     * to be drawn for the View and maps each primitive index to the mesh it belongs to.
     *
     * The primitives are ordered and partitioned by render pass. Changes in view-
     * dependent mesh state (e.g. visibility, transparency, selection) may cause
     * primitives to move between pass partitions or be removed entirely.
     *
     * The per-pass partitions of this draw list are defined by {@link renderPassPrimitiveRanges}.
     */
    primitiveMeshIndexTexture: PrimitiveMeshIndexTexture;

    /**
     * Edge primitive-to-mesh index table for this View.
     *
     * Similar to {@link primitiveMeshIndexTexture}, but contains indices for edge rendering.
     *
     * Only exists if the batch is for meshes with triangle primitives.
     */
    edgeMeshIndexTexture: PrimitiveMeshIndexTexture;

    /**
     * Per-view mesh attribute table.
     *
     * Contains mesh attributes that may vary by View, such as visibility flags,
     * selection state, per-view overrides, or view-dependent material parameters.
     *
     * Indexed by mesh index.
     */
    meshViewAttributeTexture: MeshViewAttributeTexture;

    /**
     * Primitive ranges to draw for each render pass.
     *
     * For each render pass ID, this map provides a contiguous range of primitive
     * indices within {@link primitiveMeshIndexTexture} that should be drawn for that pass.
     *
     * These ranges are intended to be used directly with `gl.drawArrays`
     * to issue one draw call per pass.
     */
    renderPassPrimitiveRanges: Map<number, PrimRange>;

    /**
     * Edge primitive ranges to draw for each render pass.
     *
     * Similar to {@link renderPassPrimitiveRanges}, but contains ranges for edge rendering.
     *
     * Only exists if the batch is for meshes with triangle primitives.
     */
    renderPassEdgePrimitiveRanges: Map<number, PrimRange>;

    /**
     * Overall primitive range to draw for this View when picking.
     */
    pickPrimitiveRange: PrimRange;
  }>;

  /**
   * Mesh attribute table shared across all Views.
   *
   * Contains mesh properties that are view-invariant, such as material identifiers,
   * static feature flags, or other mesh-level constants.
   *
   * Indexed by mesh index.
   */
  meshAttributeTexture: MeshAttributeTexture;

  /**
   * Mesh transform matrix table.
   *
   * Stores modeling (object-to-world) matrices for meshes in this batch.
   *
   * Indexed by mesh index.
   */
  meshMatrixTexture: MatrixTexture;

  /**
   * Geometry attribute table.
   *
   * Contains geometry-level metadata required to interpret vertex data,
   * such as attribute layouts, offsets, strides, or encoding modes.
   *
   * Indexed by geometry index.
   */
  geometryAttributeTexture: GeometryAttributeTexture;

  /**
   * Geometry quantization range table.
   *
   * Stores per-geometry quantization parameters used to
   * dequantize vertex positions in shaders (e.g. scale and offset).
   *
   * Indexed by geometry index.
   */
  geometryQuantRangeTexture: GeometryQuantRangeTexture;

  /**
   * Primitive index buffer for this batch.
   *
   * Contains the indices of all geometry primitives referenced by the batch.
   */
  indexTexture: IndexTexture;

  /**
   * Edge primitive index buffer.
   *
   * Similar to {@link indexTexture}, but contains indices for edge rendering.
   *
   * Only exists if the batch is for meshes with triangle primitives.
   */
  edgeIndexTexture: IndexTexture;

  /**
   * Vertex position buffer.
   *
   * Stores packed 3D vertex positions for all geometries in this batch.
   */
  vertexPositionTexture: VertexPositionTexture;

  /**
   * Vertex color buffer.
   *
   * Stores per-vertex RGB color data for geometries in this batch.
   */
  vertexColorTexture: VertexColorTexture;
}
