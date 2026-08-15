/**
 * Configuration options for GPU memory allocation in {@link core!WebGPURenderer}.
 *
 * These limits control WebGPU packed triangle segment sizing and per-view
 * instance storage. They intentionally mirror the WebGLRenderer batch
 * vocabulary where WebGPU has the same responsibility: larger batches reduce
 * draw calls but can increase one-time packing work and transient memory use;
 * smaller batches reduce streaming hitches but create more draw calls.
 */
export interface MemoryConfigs {
  /**
   * Maximum number of views with active WebGPU instance storage.
   *
   * Use `1` for single-view applications to keep per-view allocations tight.
   */
  maxViews: number;

  /**
   * Size of each RTC (Relative To Center) tile in world units.
   *
   * Mesh model matrices uploaded to WebGPU are made relative to the tile that
   * currently contains the mesh. Moving a mesh across a tile boundary only
   * rewrites that mesh's instance record with a new tile index and local
   * matrix; packed geometry storage is unchanged.
   */
  tileSize: number;

  /**
   * Maximum number of RTC tiles tracked by the WebGPU renderer.
   */
  maxTiles: number;

  /**
   * Maximum number of render batches in GPU memory.
   *
   * Reserved for parity with WebGLRenderer memory configuration. The current
   * WebGPU triangle path sizes batches from the per-batch limits below.
   */
  maxBatches: number;

  /**
   * Maximum number of vertices per packed triangle segment.
   */
  maxBatchVertices: number;

  /**
   * Maximum number of indices per packed triangle segment.
   */
  maxBatchIndices: number;

  /**
   * Maximum number of geometries per packed triangle segment.
   */
  maxBatchGeometries: number;

  /**
   * Maximum number of meshes per packed triangle segment.
   */
  maxBatchMeshes: number;

  /**
   * Maximum number of triangle primitives per packed triangle segment.
   */
  maxBatchPrims: number;

  /**
   * Maximum CPU time spent creating new packed triangle segments in one render
   * cache rebuild.
   *
   * The builder always creates at least one pending segment when work exists,
   * so very small values reduce hitches without starving the stream.
   */
  maxBatchBuildTimeMs: number;

  /**
   * Maximum number of pending packed triangle segments built in one render
   * cache rebuild.
   *
   * The builder always creates at least one segment when work exists. Use this
   * with {@link maxBatchBuildTimeMs} to keep streaming work bounded even when
   * timer granularity or one expensive segment makes the time budget imprecise.
   * Use a negative value to build pending segments synchronously during render
   * cache preparation instead of using the background pending-segment pump.
   */
  maxBatchBuildSegments: number;

  /**
   * Enables CPU-side frustum culling while building per-view draw batches.
   *
   * This does not change packed triangle segment ownership. It only suppresses
   * draw batches for meshes whose bounds are outside the active View frustum.
   */
  frustumCulling: boolean;

  /**
   * Minimum projected mesh size, in canvas pixels, required to keep a mesh in
   * the per-view draw batches.
   *
   * Use `0` to disable projected-size culling.
   */
  minProjectedCanvasSize: number;

  /**
   * Fits packed triangle pages when a streaming model has become sealed.
   *
   * Streaming models keep append-friendly page headroom while they are still
   * loading. Once sealed, the renderer can rebuild their packed pages without
   * that headroom to reduce static GPU memory use. Disable this when an
   * application deliberately keeps appending meshes to sealed stream models.
   */
  compactSealedStreamPages: boolean;

  /**
   * Fits packed triangle pages for live streaming models without reserving
   * append headroom for additional compatible segments.
   *
   * This lowers peak GPU memory for very large streams at the cost of more
   * packed pages and draw calls.
   */
  compactStreamPages: boolean;
}
