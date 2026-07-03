/**
 * A handle to a mesh stored in GPU memory.
 *
 * @internal
 */
export interface GPUMemoryMeshHandle {

  /**
   * Index of the batch containing the mesh.
   */
  gpuMemoryBatchIndex: number;

  /**
   * Index of the mesh within the batch.
   */
  meshIndex: number;

}
