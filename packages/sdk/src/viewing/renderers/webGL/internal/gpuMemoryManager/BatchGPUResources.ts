import { DataTexture } from "./dataTextures/DataTexture";
import { type PrimRange } from "./geometry/PrimRange";
import {PrimitiveMeshIndexTexture} from "./dataTextures/PrimitiveMeshIndexTexture";
import {MeshAttributeTexture} from "./dataTextures/MeshAttributeTexture";
import {LinePatternTexture} from "./dataTextures/LinePatternTexture";
import {HatchPatternTexture} from "./dataTextures/HatchPatternTexture";
import {PolylineCumDistTexture} from "./dataTextures/PolylineCumDistTexture";
import {MatrixTexture} from "./dataTextures/MatrixTexture";
import {GeometryAttributeTexture} from "./dataTextures/GeometryAttributeTexture";
import {GeometryQuantRangeTexture} from "./dataTextures/GeometryQuantRangeTexture";
import {VertexPositionTexture} from "./dataTextures/VertexPositionTexture";
import {VertexColorTexture} from "./dataTextures/VertexColorTexture";
import {VertexNormalTexture} from "./dataTextures/VertexNormalTexture";
import {VertexUVTexture} from "./dataTextures/VertexUVTexture";
import {TextureAtlas} from "./dataTextures/TextureAtlas";
import {MeshViewAttributeTexture} from "./dataTextures/MeshViewAttributeTexture";
import {IndexTexture} from "./dataTextures/IndexTexture";
import type {TriangleGeometryVBOBatch} from "./vbos/TriangleGeometryVBOBatch";
import type {SceneModelMemoryPolicy} from "../../../../../model/scene";

export type TriangleGeometryStorageKind = "dtx" | "vbo";

/**
 * GPU resources for a single sorted render batch.
 *
 * A {@link WebGLRenderer} groups renderable meshes into batches that share
 * compatible rendering state in order to minimize draw calls. Each batch owns
 * the GPU-resident textures and optional VBOs required to render the meshes in
 * that batch.
 *
 * A batch contains:
 * - **Per-view textures**, whose contents may differ by View (camera, picking view, etc.)
 * - **View-invariant textures**, shared across all Views
 * - **Optional VBO geometry**, used by triangle VBO-backed draw paths
 *
 * Instances are stored in {@link RendererGPUResources.batches}.
 *
 * @internal
 */
export interface BatchGPUResources {

  /**
   * Renderer allocation scope represented by this batch.
   */
  allocationKind: "dynamic" | "sealedModel" | "sealedBatch";

  /**
   * Capacity policy requested by the source SceneModel.
   */
  memoryPolicy: SceneModelMemoryPolicy;

  /**
   * Source SceneModel ID when this batch was created from a sealed model or
   * committed SceneModel batch.
   */
  sceneModelId?: string;

  /**
   * Source SceneModel batch ID when this batch was created from a committed
   * SceneModel batch.
   */
  sceneBatchId?: string;

  /**
   * Geometry storage kind used by this batch.
   *
   * `"dtx"` batches store primitive lists, indices, quantization ranges and
   * positions in data textures. `"vbo"` triangle batches store the primitive
   * draw list and baked positions in {@link triangleGeometryVBO}, while still
   * using data textures for mesh/material/view state.
   */
  geometryStorage: TriangleGeometryStorageKind;

  /**
   * Optional VBO storage for triangle geometry.
   *
   * Present only on batches constructed with `geometryStorage === "vbo"`.
   * DTX batches leave this absent. VBO-backed draw techniques use this for
   * primitive/index/position geometry while continuing to use data textures for
   * per-mesh and material state.
  */
  triangleGeometryVBO?: TriangleGeometryVBOBatch;

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
     * The per-pass partitions of this draw list are defined by `renderPassPrimitiveRanges`.
     */
    primitiveMeshIndexTexture?: PrimitiveMeshIndexTexture;

    /**
     * Edge primitive-to-mesh index table for this View.
     *
     * Similar to `primitiveMeshIndexTexture`, but contains indices for edge rendering.
     *
     * Only exists if the batch is for meshes with triangle primitives.
     */
    edgeMeshIndexTexture?: PrimitiveMeshIndexTexture;

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
     * indices within `primitiveMeshIndexTexture` that should be drawn for that pass.
     *
     * These ranges are intended to be used directly with `gl.drawArrays`
     * to issue one draw call per pass.
     */
    renderPassPrimitiveRanges: Map<number, PrimRange>;

    /**
     * Edge primitive ranges to draw for each render pass.
     *
     * Similar to `renderPassPrimitiveRanges`, but contains ranges for edge rendering.
     *
     * Only exists if the batch is for meshes with triangle primitives.
     */
    renderPassEdgePrimitiveRanges: Map<number, PrimRange>;

    /**
     * Overall primitive range to draw for this View when picking.
     */
    pickPrimitiveRange: PrimRange;

    /**
     * Overall edge-primitive range to draw for this View when snap-picking.
     *
     * Analogous to `pickPrimitiveRange` but covers edges from the
     * dihedral-angle-thresholded edge index buffer — i.e. the
     * silhouette / crease edges only, never the interior diagonals
     * shared between coplanar triangles. Snap-to-vertex and
     * snap-to-edge both source from this so neither lands on
     * triangulation artefacts.
     */
    pickEdgePrimitiveRange: PrimRange;
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
   * Per-batch line-pattern table.
   *
   * One slot per distinct {@link model!scene.SceneMaterial | SceneMaterial}
   * with a non-default `linePattern` that's referenced by a line
   * mesh in this batch. Each slot carries the eight pattern entries
   * (line-width units, Float32 bit patterns). Slot 0 is reserved
   * as the "no pattern" sentinel — meshes whose materials don't
   * override the pattern leave their `linePatternSlot` (in
   * {@link meshAttributeTexture}) at 0, and the thick-line shader
   * falls back to the View's `linesMaterial.linePattern` uniform.
   *
   * The table is allocated for every batch — pure-triangle batches
   * pay the storage (~8 KB capped) but their meshes never set a
   * non-zero slot, so the texture stays empty and the shader never
   * fetches from it. The savings live on the mesh side: every
   * non-line mesh saves 32 bytes that would otherwise live in
   * {@link meshAttributeTexture}.
   */
  /**
   * Per-batch line-pattern table — eager-allocated so the
   * thick-line shader's `uLinePatternTexture` sampler always
   * has a same-type texture bound at its assigned unit. Slot
   * 0 is the "no per-mesh pattern" sentinel; real material
   * slots start at 1 and are written lazily on demand.
   */
  linePatternTexture: LinePatternTexture;

  /**
   * Per-batch hatch-pattern table.
   *
   * One slot per distinct {@link model!scene.SceneMaterial | SceneMaterial}
   * with a non-default `hatchPattern` that's referenced by a
   * triangle-surface mesh in this batch. Each slot carries up
   * to four line families plus an ink RGBA colour, all as
   * RGBA32F values (no bit-pattern reinterpret needed).
   *
   * Slot 0 is reserved as the "no hatch" sentinel — meshes
   * whose materials don't override the pattern leave their
   * `hatchPatternSlot` (in {@link meshAttributeTexture}) at 0,
   * and the surface technique skips the lookup entirely.
   *
   * Eager-allocated so the triangle-surface shaders'
   * `uHatchPatternTexture` sampler always has a same-type
   * texture bound at its assigned unit.
   */
  hatchPatternTexture: HatchPatternTexture;

  /**
   * Per-batch, per-line-segment cumulative model-space distance
   * from the parent polyline's start. Used by the thick-line
   * shader to keep dash patterns continuous across polyline
   * joints instead of restarting the phase at every segment.
   *
   * Indexed via
   * `geometryAttributes.polylineCumDistBase + primOffset`.
   * Eager-allocated so the thick-line shader's
   * `uPolylineCumDistTexture` sampler always has a same-type
   * texture bound at its assigned unit. Per-geometry portions
   * within the texture are still allocated lazily on first
   * `LinesPrimitive` upload.
   */
  polylineCumDistTexture: PolylineCumDistTexture;

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
  geometryQuantRangeTexture?: GeometryQuantRangeTexture;

  /**
   * Primitive index buffer for this batch.
   *
   * Contains the indices of all geometry primitives referenced by the batch.
   */
  indexTexture?: IndexTexture;

  /**
   * Edge primitive index buffer.
   *
   * Similar to {@link indexTexture}, but contains indices for edge rendering.
   *
   * Only exists if the batch is for meshes with triangle primitives.
   */
  edgeIndexTexture?: IndexTexture;

  /**
   * Vertex position buffer.
   *
   * Stores packed 3D vertex positions for all geometries in this batch.
   */
  vertexPositionTexture?: VertexPositionTexture;

  /**
   * Vertex color buffer.
   *
   * Stores per-vertex RGB color data for geometries in this batch.
   */
  vertexColorTexture?: VertexColorTexture;

  /**
   * Vertex normal buffer (optional).
   *
   * Stores octahedral-encoded per-vertex normals as RG16UI pairs. Only
   * allocated for batches whose meshes provide vertex normals; for
   * flat-shaded batches this property is omitted and the renderer derives
   * a face normal in the fragment shader via `dFdx/dFdy`.
   */
  vertexNormalTexture?: VertexNormalTexture;

  /**
   * Vertex UV buffer (optional).
   *
   * Stores quantised per-vertex UV pairs as RG16UI. Only allocated for
   * batches whose meshes provide UV coordinates; the UV-aware draw
   * technique variant binds this to the `uVertexUVTexture` sampler and
   * emits a `vUV` varying. Non-UV variants don't reference the texture.
   */
  vertexUVTexture?: VertexUVTexture;

  /**
   * Albedo (base-colour) texture atlas (optional).
   *
   * One shelf-packed sRGB 2D texture per UV-bearing batch. Each
   * {@link SceneTexture} referenced by the batch's meshes occupies a
   * sub-rect; the per-mesh UV transform stored in
   * {@link MeshAttributeTexture} remaps `[0, 1]` UVs into that sub-rect.
   * Untextured meshes get a sentinel transform (scale = 0) that collapses
   * the sample to a pre-stamped white texel — no shader branching.
   */
  albedoAtlasTexture?: TextureAtlas;

  /**
   * Metallic-roughness texture atlas (optional).
   *
   * Linear RGBA8 atlas mirroring the albedo atlas in shape and packing.
   * Channel layout follows glTF 2.0: G = roughness, B = metallic. The
   * shader multiplies the sampled `mr.g` and `mr.b` against
   * `material.roughness` and `material.metallic` respectively, so an
   * artist setting both to `1.0` lets the texture drive the values
   * directly. Untextured meshes hit the white sentinel and the
   * multiplier is `1.0` — passthrough.
   */
  metallicRoughnessAtlasTexture?: TextureAtlas;

  /**
   * Tangent-space normal-map atlas (optional).
   *
   * Linear RGBA8. RGB encodes a tangent-space normal as `(x*0.5+0.5,
   * y*0.5+0.5, z*0.5+0.5)`; the shader decodes via `n*2 - 1` and
   * transforms by a per-pixel TBN built from view-space derivatives
   * (Schueler's robust frame). Sentinel = `(128, 128, 255, 255)` so
   * untextured meshes decode to `(0, 0, 1)` — no perturbation, BRDF
   * uses the smooth `vViewNormal` unchanged.
   */
  normalMapAtlasTexture?: TextureAtlas;

  /**
   * Emissive texture atlas (optional).
   *
   * sRGB atlas mirroring the albedo atlas (emissive is colour data). The
   * shader multiplies the sample by the per-mesh emissive colour factor and
   * adds the result to the lit colour. Sentinel = white; untextured meshes
   * carry a `[0,0,0]` factor, so the sentinel contributes no glow.
   */
  emissiveAtlasTexture?: TextureAtlas;

  /**
   * Ambient-occlusion texture atlas (optional).
   *
   * Linear RGBA8; AO in the `R` channel, multiplied into the indirect
   * (ambient + IBL) lighting term. Sentinel = white (`R = 1`), so untextured
   * meshes get no occlusion.
   */
  occlusionAtlasTexture?: TextureAtlas;
}
