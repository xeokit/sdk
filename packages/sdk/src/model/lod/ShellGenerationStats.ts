/**
 * Generation metrics returned with a {@link ShellGeneratorResult}.
 *
 * These values are useful for choosing shell resolution, simplification
 * settings and LOD thresholds for a model family.
 *
 * @public
 */
export interface ShellGenerationStats {
  /**
   * Number of source {@link model!scene.SceneObject | SceneObject}s passed to
   * the shell generator.
   */
  sourceObjectCount: number;

  /**
   * Number of source triangles visited while collecting input geometry.
   */
  sourceTriangleCount: number;

  /**
   * Number of source vertices visited while collecting input geometry.
   */
  sourceVertexCount: number;

  /**
   * Voxel grid dimensions as `[x, y, z]`.
   */
  gridDimensions: [number, number, number];

  /**
   * Total number of voxels in the grid.
   */
  voxelCount: number;

  /**
   * Number of voxels intersected by source triangles.
   */
  occupiedVoxelCount: number;

  /**
   * Number of triangles in the generated shell.
   */
  shellTriangleCount: number;

  /**
   * Number of vertices in the generated shell.
   */
  shellVertexCount: number;

  /**
   * Time spent generating the shell, in milliseconds.
   */
  generationTimeMs: number;

  /**
   * Ratio of source triangles to shell triangles.
   *
   * A value of `10` means the source had roughly ten times as many triangles as
   * the generated shell. Empty shells report `0`.
   */
  triangleReductionRatio: number;
}
