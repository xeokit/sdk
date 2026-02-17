
import {type SceneMesh} from "../../../scene";
import {type RenderPassValue} from "../RENDER_PASSES";
import type {DrawTechnique} from "../drawOps/DrawTechnique";

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
   * Base primitive base index for this batch.
   */
  primBaseIndex: number;

  /**
   * Whether this batch supports Screen Space Ambient Occlusion (SSAO) rendering.
   */
  saoSupported: boolean;

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
   * This indexes the `GPUMemoryEditor.dataTextures.batches` array. Before drawing this batch,
   * the renderer will bind the corresponding data textures from that array, which contain the
   * mesh data needed for rendering.
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

