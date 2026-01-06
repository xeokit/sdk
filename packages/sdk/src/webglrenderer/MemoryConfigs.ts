/**
 * Configuration options for GPU memory allocation in {@link WebGLRenderer}.
 *
 * These limits control the maximum number of render batches, tiles, vertices, indices, geometries, meshes, and primitives
 * that can be allocated in GPU memory. Adjusting these values allows tuning of memory usage and rendering performance
 * for large 3D models.
 */
export interface MemoryConfigs {
  /**
   * Maximum number of RTC (Relative To Center) tiles in GPU memory.
   * @remarks
   * Tiles partition world space into regions, enabling high-precision vertex positions relative to each tile origin.
   */
  maxTiles: number;

  /**
   * Maximum number of render batches in GPU memory.
   * @remarks
   * A render batch groups meshes with the same primitive type for efficient rendering.
   */
  maxBatches: number;

  /**
   * Maximum number of vertices per render batch.
   */
  maxBatchVertices: number;

  /**
   * Maximum number of indices per render batch.
   * @remarks
   * Indices define primitive connectivity for indexed drawing.
   */
  maxBatchIndices: number;

  /**
   * Maximum number of geometries per render batch.
   * @remarks
   * Each mesh uses one geometry.
   */
  maxBatchGeometries: number;

  /**
   * Maximum number of meshes per render batch.
   * @remarks
   * Each mesh is associated with one geometry.
   */
  maxBatchMeshes: number;

  /**
   * Maximum number of primitives (triangles, lines, or points) per render batch.
   */
  maxBatchPrims: number;
}
