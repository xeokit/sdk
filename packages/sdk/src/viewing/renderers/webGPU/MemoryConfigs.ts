/**
 * Configuration options for GPU memory allocation in {@link core!WebGPURenderer}.
 *
 * These values are used by the WebGPU backend when it allocates RTC tile
 * storage, packs renderable geometry into WebGPU buffer pages, creates
 * per-view instance buffers, and decides whether camera-dependent culling can
 * suppress draw batches. Larger packed segments usually reduce WebGPU draw
 * calls, while smaller segments reduce the amount of CPU packing and GPU
 * upload work done in one rebuild.
 */
export interface MemoryConfigs {
  /**
   * Maximum number of Views with active WebGPU instance storage.
   *
   * WebGPU stores per-view instance records in frame-local buffers. Increase
   * this when one WebGPURenderer drives multiple Views concurrently; keep it
   * at `1` for single-view applications to avoid reserving unused per-view
   * instance capacity.
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
   *
   * WebGPU allocates one storage buffer sized from this value. When tile
   * capacity is exhausted, additional meshes fall back to the origin tile,
   * which preserves rendering but loses the precision benefit for those
   * meshes.
   */
  maxTiles: number;

  /**
   * Maximum number of render batches.
   *
   * This is retained for parity with WebGLRenderer memory configuration. The
   * current WebGPU renderer does not use it as the primary packing limit;
   * packed WebGPU pages are bounded by {@link maxBatchVertices},
   * {@link maxBatchIndices}, {@link maxBatchGeometries}, {@link maxBatchMeshes},
   * and {@link maxBatchPrims}.
   */
  maxBatches: number;

  /**
   * Maximum number of vertices per packed triangle segment.
   *
   * This bounds each WebGPU buffer-page segment for triangles, points, and
   * thick lines after WebGPU-specific expansion. Points and thick line
   * segments expand to quad geometry before this limit is applied.
   */
  maxBatchVertices: number;

  /**
   * Maximum number of indices per packed triangle segment.
   *
   * This bounds triangle indices and is also used as the edge-index limit for
   * edge rendering. Smaller values create more WebGPU draw batches; larger
   * values reduce draw calls but make individual packing/upload jobs larger.
   */
  maxBatchIndices: number;

  /**
   * Maximum number of geometries per packed triangle segment.
   *
   * WebGPU starts a new packed segment when adding another geometry would
   * exceed this value.
   */
  maxBatchGeometries: number;

  /**
   * Maximum number of meshes per packed triangle segment.
   *
   * WebGPU starts a new packed segment when adding another mesh would exceed
   * this value.
   */
  maxBatchMeshes: number;

  /**
   * Maximum number of triangle primitives per packed triangle segment.
   *
   * WebGPU derives this from the packed index count for triangle-family draws.
   * It gives callers a primitive-count cap independent of raw index count.
   */
  maxBatchPrims: number;

  /**
   * Maximum CPU time spent creating new packed triangle segments in one render
   * cache rebuild.
   *
   * The WebGPU packed-page builder always creates at least one pending segment
   * when work exists, so very small values reduce hitches without starving the
   * stream.
   */
  maxBatchBuildTimeMs: number;

  /**
   * Maximum number of pending packed triangle segments built in one WebGPU
   * render-cache rebuild.
   *
   * The builder always creates at least one segment when work exists. Use this
   * with {@link maxBatchBuildTimeMs} to keep streaming work bounded even when
   * timer granularity or one expensive segment makes the time budget imprecise.
   * Use a negative value to build all pending WebGPU segments synchronously
   * during render-cache preparation instead of using the pending-segment pump.
   */
  maxBatchBuildSegments: number;

  /**
   * Enables CPU-side frustum culling while building per-view draw batches.
   *
   * This does not change packed WebGPU geometry ownership. It only suppresses
   * draw batches for packed segments whose bounds are outside the active View
   * frustum, so geometry remains resident and can be drawn again when the
   * camera changes.
   */
  frustumCulling: boolean;

  /**
   * Minimum projected packed-segment size, in canvas pixels, required to keep
   * the segment in the per-view WebGPU draw batches.
   *
   * Use `0` to disable projected-size culling. This affects draw submission
   * only; it does not remove packed geometry from WebGPU buffers.
   */
  minProjectedCanvasSize: number;

  /**
   * Fits WebGPU packed triangle pages when a streaming model has become sealed.
   *
   * Streaming models keep append-friendly page headroom while they are still
   * loading. Once sealed, the renderer can rebuild their packed pages without
   * that headroom to reduce static GPU memory use. Disable this when an
   * application deliberately keeps appending meshes to sealed stream models.
   */
  compactSealedStreamPages: boolean;

  /**
   * Fits WebGPU packed triangle pages for live streaming models without
   * reserving append headroom for additional compatible segments.
   *
   * This lowers peak GPU memory for very large streams at the cost of more
   * packed pages and draw calls.
   */
  compactStreamPages: boolean;
}
