/**
 * Configuration options for GPU memory allocation in {@link WebGLRenderer}.
 *
 * These limits control the maximum number of render batches, tiles, vertices, indices, geometries, meshes, and primitives
 * that can be allocated in GPU memory. Adjusting these values allows tuning of memory usage and rendering performance
 * for large 3D models.
 */
export interface MemoryConfigs {

  /**
   * Size of each RTC (Relative To Center) tile in world units.
   *
   * @remarks
   *
   * In {@link WebGLRenderer}, RTC (Relative-To-Center) tiles are used internally to maintain numerical precision when rendering very
   * large models or scenes with world-space coordinates far from the origin. Instead of rendering geometry using
   * absolute world coordinates—which can exceed the limited floating-point precision available on GPUs—the renderer
   * automatically partitions world space into tiles, each with its own local center. Vertex positions within a tile are stored
   * relative to that tile’s center, keeping their magnitudes small and precise. At render time, xeokit adjusts the
   * view matrix per tile (via {@link rtc!createRTCViewMat | createRTCViewMat()}) so that the camera effectively renders the scene relative to the
   * tile’s center, while preserving correct world positioning. This approach avoids visible “jittering” artifacts
   * caused by floating-point rounding errors (typically limited to ~7–9 significant digits in WebGL), enabling stable,
   * high-precision rendering of large BIM and geospatial datasets without requiring double-precision GPU support.
   *
   * In xeokit, the choice of RTC tile size involves a trade-off between precision, memory efficiency, and rendering
   * overhead. **Smaller tiles** keep vertex coordinates very close to their local centers, maximizing numerical
   * precision and virtually eliminating floating-point jitter even in extremely large or dense scenes. However, they
   * increase the number of tiles, which can raise CPU overhead due to more per-tile state changes, view-matrix updates,
   * and draw calls, as well as slightly higher memory usage for storing additional tile metadata. **Larger tiles**,
   * by contrast, reduce the number of tiles and associated draw calls, improving CPU efficiency and lowering management
   * overhead, but at the cost of reduced numerical precision as vertex coordinates grow larger within each tile. If
   * tiles become too large, this can reintroduce subtle rendering artifacts, especially for geometry far from the
   * tile center. Selecting an appropriate tile size in xeokit therefore balances precision requirements against runtime
   * performance and memory efficiency, depending on the scale and distribution of the model.
   *
   * This configuration is the only place where RTC tiling is exposed to the user; all other RTC management is handled
   * internally and transparently by the renderer.
   */
  tileSize: number;

  /**
   * Maximum number of RTC (Relative To Center) tiles in GPU memory.
   * @remarks
   * Tiles partition world space into regions, enabling high-precision vertex positions relative to each tile origin.
   */
  maxTiles: number;

  /**
   * Maximum number of render batches in GPU memory.
   * @remarks
   * A render batch groups meshes with the same primitive type for efficient rendering. The size of each batch is
   * determined by the limits on vertices, indices, geometries, meshes, and primitives. Bigger batches mean fewer draw calls
   * and better performance, but use more GPU memory.
   */
  maxBatches: number;

  /**
   * Maximum number of vertices per render batch.
   */
  maxBatchVertices: number;

  /**
   * Maximum number of indices per render batch.
   * @remarks
   * Indices define primitive connectivity for indexed drawing. These are used for triangle and line primitives.
   */
  maxBatchIndices: number;

  /**
   * Maximum number of geometries per render batch.
   * @remarks
   * Each mesh is associated with one geometry.
   * A geometry can be shared by multiple meshes.
   * Each mesh can belong to one object.
   */
  maxBatchGeometries: number;

  /**
   * Maximum number of meshes per render batch.
   * @remarks
   * Each mesh is associated with one geometry.
   * A geometry can be shared by multiple meshes.
   * Each mesh can belong to one object.
   */
  maxBatchMeshes: number;

  /**
   * Maximum number of primitives (triangles, lines, or points) per render batch.
   */
  maxBatchPrims: number;
}
