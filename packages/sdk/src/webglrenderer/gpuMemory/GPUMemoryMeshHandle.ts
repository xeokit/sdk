/**
 * A handle to a mesh stored in GPU memory.
 */
export class GPUMemoryMeshHandle {

  /**
   * Index of the layer containing the mesh.
   */
  layerIndex: number;

  /**
   * Index of the mesh within the layer.
   */
  meshIndex: number;

  /**
   * Number of indices in the mesh.
   * This helps GPUMemory users to know how many indices to draw in total.
   */
  numIndices: number;
}
