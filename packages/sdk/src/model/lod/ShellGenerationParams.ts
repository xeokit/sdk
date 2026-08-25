/**
 * Taubin smoothing settings for shell meshes generated with
 * `"surfaceNets"` extraction.
 *
 * Taubin smoothing alternates a positive Laplacian pass with a negative
 * inflation pass to reduce block noise without collapsing the shell as much as
 * plain Laplacian smoothing.
 */
export interface ShellSmoothingParams {
  /**
   * Number of smoothing iterations to run.
   *
   * Higher values produce smoother shells but cost more generation time and can
   * remove small silhouette details.
   */
  iterations?: number;

  /**
   * Positive smoothing pass factor.
   *
   * Larger values move vertices more aggressively toward their neighbours.
   */
  lambda?: number;

  /**
   * Negative inflation pass factor.
   *
   * This counteracts Laplacian shrinkage. It is normally negative.
   */
  mu?: number;

  /**
   * Maximum movement from the original extracted surface, measured in voxels.
   *
   * This clamps smoothing so the shell remains close to the voxelized source.
   */
  maxDisplacementVoxels?: number;
}

/**
 * Vertex-clustering simplification settings for generated shell meshes.
 */
export interface ShellSimplificationParams {
  /**
   * Target triangle budget after extraction and optional smoothing.
   *
   * The simplifier stops when the mesh is at or below this count, or when it
   * reaches the configured cluster-size limit.
   */
  targetTriangleCount?: number;

  /**
   * Maximum clustering cell size, measured in voxels.
   *
   * Larger cells reduce triangles more aggressively but lose more silhouette
   * detail.
   */
  maxClusterSizeVoxels?: number;
}

/**
 * Options that control shell generation from source triangle geometry.
 *
 * Use lower resolutions for cheaper shells and lower memory use. Use
 * `"surfaceNets"` plus smoothing when a less blocky silhouette is more
 * important than exact voxel-boundary coverage.
 *
 * @example
 * ```javascript
 * const shell = generator.generate(objects, {
 *   shellResolution: 64,
 *   extraction: "surfaceNets",
 *   smoothing: {
 *     iterations: 3
 *   },
 *   simplification: {
 *     targetTriangleCount: 4000
 *   }
 * });
 * ```
 */
export interface ShellGenerationParams {
  /**
   * Longest voxel grid axis.
   *
   * Reasonable first values are 32, 64 and 128. The generator clamps this to
   * {@link MAX_SHELL_RESOLUTION}.
   */
  shellResolution?: number;

  /**
   * Explicit voxel size in shell-local/world units.
   *
   * When set to a positive value, this overrides {@link shellResolution}.
   */
  voxelSize?: number;

  /**
   * Surface extraction method.
   *
   * - "voxelFaces" emits blocky voxel boundary faces.
   * - "surfaceNets" emits a dual mesh with one smoothed vertex per mixed
   *   voxel neighborhood. It is smoother, but less exact and more experimental.
   */
  extraction?: "voxelFaces" | "surfaceNets";

  /**
   * Optional post-extraction smoothing. Only applied to "surfaceNets".
   *
   * When omitted, surface-net extraction uses a conservative default.
   * Set to false to disable smoothing.
   */
  smoothing?: false | ShellSmoothingParams;

  /**
   * Optional low-poly simplification. This first implementation uses
   * vertex clustering, which is fast and robust but not feature-preserving.
   *
   * Set to `false` to disable simplification.
   */
  simplification?: false | ShellSimplificationParams;
}
