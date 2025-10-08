import {MeshCounts} from "./MeshCounts";

/**
 * A DrawBatch represents a collection of meshes that share the same rendering properties and can be rendered together 
 * in a single draw call using a `DrawOp`.
 */
export interface DrawBatch {

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
   * Counts of meshes and their visibility states for each view. These are used to build the render flags for the views.
   */
  meshCounts: MeshCounts[];

  /**
   * The index of this batch's memory in the GPUMemory system.
   * This indexes the `GPUMemoryWriteIF.dataTextures.batches` array. Before drawing this batch,
   * the renderer will bind the corresponding data textures from that array, which contain the
   * mesh data needed for rendering.
   */
  gpuMemoryBatchIndex: number;
}

