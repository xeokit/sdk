/**
 * Enumeration representing the result of a free memory check for storing a mesh in GPU memory.
 */
export enum GPUMemoryCheckResult {

  /**
   * Sufficient GPU memory is available; the mesh can be stored and rendered.
   */
  OK = 0,

  /**
   * The maximum number of GPU meshes has been reached; cannot store more meshes.
   */
  TooManyMeshes = 1,

  /**
   * The mesh has no associated geometry; cannot store in GPU memory.
   */
  NoGeometry = 2,

  /**
   * The maximum number of unique GPU geometries has been reached.
   */
  TooManyGeometries = 3,

  /**
   * Insufficient GPU memory for additional vertex data.
   */
  NotEnoughVertexSpace = 4,

  /**
   * Insufficient GPU memory for additional vertex colors.
   */
  NotEnoughColorSpace = 5,

  /**
   * Insufficient GPU memory for additional indices.
   */
  NotEnoughIndexSpace = 6,

  /**
   * Insufficient GPU memory for additional edge indices.
   */
  NotEnoughEdgeIndexSpace = 7,

  /**
   * Insufficient GPU memory for additional primitives.
   */
  NotEnoughPrimSpace,
}
