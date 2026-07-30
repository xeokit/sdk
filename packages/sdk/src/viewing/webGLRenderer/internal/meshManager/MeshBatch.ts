
import {type SceneMesh} from "../../../../model/scene";
import {type RenderPassValue} from "../RENDER_PASSES";
import type {DrawTechnique} from "../drawOps/DrawTechnique";
import type {TriangleGeometryStorageKind} from "../gpuMemoryManager/BatchGPUResources";

/**
 * A MeshBatch represents a collection of meshes that share the same rendering properties and can be rendered together
 * in a single draw call using a {@link DrawTechnique}.
 *
 * @internal
 */
export interface MeshBatch {

  /**
   * Primitive type of the meshes in this batch.
   */
  primitive: number;

  /**
   * Geometry storage used by this batch.
   */
  geometryStorage: TriangleGeometryStorageKind;

  /**
   * Whether the batch's geometries carry per-vertex normals.
   *
   * Mirrors the `hasNormals` axis the {@link MeshManager} splits batches on.
   * The renderer uses this flag to dispatch between the smooth-shaded and
   * flat-shaded {@link DrawTechnique} variants — geometries within a batch
   * always agree on this, so the dispatch is per-batch, not per-mesh.
   */
  hasNormals: boolean;

  /**
   * Whether the batch's geometries carry per-vertex UV coordinates.
   *
   * Independent axis from {@link hasNormals}. The renderer uses this to
   * select draw-technique variants that bind a UV data texture and emit a
   * `vUV` varying — the foundation for material-texture support.
   */
  hasUVs: boolean;

  /**
   * Whether the batch's textures must be sampled via the
   * **triplanar** world-space fallback rather than the standard
   * UV-attribute path.
   *
   * Set when the batch's meshes share `(material has any texture)
   * && (geometry has no UVs)` — typical of BIM, sweeps and lofted
   * curve geometry. Mutually exclusive with {@link hasUVs}: the
   * renderer dispatches triplanar batches to a sibling shader
   * variant that derives sample coordinates from world position,
   * blended by world normal.
   */
  triplanar: boolean;

  /**
   * Whether the batch's per-batch atlases ship with a full mip
   * pyramid and are sampled trilinearly.
   *
   * Set when at least one mesh in the batch carries a material
   * referencing a {@link model!scene.SceneTexture | SceneTexture}
   * with `SceneTextureParams.mipmap === true`. Routes to the
   * mipmap-bearing atlas variant; non-opted-in textures stay on
   * the cheap single-level path.
   */
  mipmap: boolean;

  /**
   * Base primitive base index for this batch.
   */
  primBaseIndex: number;

  /**
   * Whether this batch supports Screen Space Ambient Occlusion (SSAO) rendering.
   */
  saoSupported: boolean;

  /**
   * Whether this batch supports directional shadow-map rendering.
   */
  shadowsSupported: boolean;

  /**
   * Free-form bin identifier shared by every mesh in this batch — the
   * value of {@link model!scene.SceneMesh.bin | SceneMesh.bin} that the
   * {@link MeshManager} hashed into this batch's bucket. `undefined`
   * means the implicit "default" bin.
   *
   * The renderer honours the
   * {@link model!scene.SceneMesh.bin | SceneMesh.bin} contract by
   * iterating batches twice per frame: once for `bin === undefined`
   * batches (the main scene), then `gl.clear(gl.DEPTH_BUFFER_BIT)`,
   * then once for `bin === "overlay"` batches (gizmo handles, HUD,
   * etc.), so the overlay-bin meshes render as "floating" on top of
   * everything else.
   */
  bin?: string;

  /**
   * The total number of indices in all meshes of this batch. This is used with WebGL draw calls to determine how many indices to draw
   * when drawing this batch.
   */
  numIndices: number;

  /**
   * The total number of vertices in all meshes of this batch. This is used for various calculations and optimizations related to rendering.
   */
  numVertices: number;

  /**
   * The index of this batch's memory in the GPUMemoryManager system.
   * This indexes the `GPUMemoryManager.gpuResources.batches` array. Before drawing this batch,
   * the renderer will bind the corresponding batch resources from that array, which contain the
   * mesh state and either DTX or VBO geometry needed for rendering.
   */
  gpuMemoryBatchIndex: number;

  /**
   * Gets the SceneMesh at the specified index in this batch, if it exists.
   * @param meshIndex
   */
  getMeshAtIndex( meshIndex: number ): SceneMesh | null;

  /**
   * Gets the parameters needed for a drawArrays call for a specific mesh in this batch.
   * @param meshIndex
   */
  getDrawArraysParamsForMesh( meshIndex: number ): { first: number; count: number } | null;

  /**
   * Determines if there are any meshes in this batch that should be rendered in the specified render pass for the given view.
   * @param viewIndex
   * @param renderPass
   */
  hasMeshesInRenderPass(viewIndex: number, renderPass: RenderPassValue ): boolean;
}
