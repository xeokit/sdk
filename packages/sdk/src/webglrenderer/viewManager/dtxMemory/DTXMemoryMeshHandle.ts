/**
 * A handle to a mesh stored in GPU memory.
 */
export class DTXMemoryMeshHandle {

  /**
   * Index of the batch containing the mesh.
   */
  batchIndex: number;

  /**
   * Index of the mesh within the batch.
   */
  meshIndex: number;

  /**
   * Number of indices in the mesh.
   * This helps DTXMemory users to know how many indices to drawBatch in total for TRIANGLES and LINES.
   */
  numIndices: number;

  /**
   * Number of vertices in the mesh.
   * This helps DTXMemory users to know how many vertices to drawBatch in total for POINTS.
   */
  numVertices: number;
}
