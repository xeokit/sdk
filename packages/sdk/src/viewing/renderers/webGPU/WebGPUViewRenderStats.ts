/**
 * CPU timing summary for the last WebGPU frame rendered for one View.
 */
export interface WebGPUViewRenderCPUTimeStats {
  /**
   * Total CPU time spent preparing and rendering the frame, in milliseconds.
   */
  frameMs: number;

  /**
   * CPU time spent preparing render inputs before binning and batching, in milliseconds.
   */
  prepareMs: number;

  /**
   * CPU time spent classifying renderable meshes into render bins, in milliseconds.
   */
  binningMs: number;

  /**
   * CPU time spent building per-view draw batches, in milliseconds.
   */
  batchingMs: number;

  /**
   * CPU time spent creating or updating packed draw-batch data, in milliseconds.
   */
  drawBatchMs: number;

  /**
   * CPU time spent classifying triangle fill batches by draw technique, in milliseconds.
   */
  triangleFillClassificationMs: number;

  /**
   * CPU time spent inside draw-operation batch submission, in milliseconds.
   */
  drawSubmissionMs: number;

  /**
   * CPU time spent uploading changed GPU buffer data, in milliseconds.
   */
  uploadMs: number;

  /**
   * CPU time spent encoding WebGPU commands, in milliseconds.
   */
  commandEncodingMs: number;

  /**
   * CPU time spent submitting encoded WebGPU commands, in milliseconds.
   */
  submitMs: number;
}

/**
 * Draw-call and primitive counts for one WebGPU render bin.
 */
export interface WebGPUViewRenderBinStats {
  /**
   * Render bin name, such as `opaque`, `transparent`, `edges`, or a pass-specific bin.
   */
  name: string;

  /**
   * Number of draw calls submitted for this bin.
   */
  numDrawCalls: number;

  /**
   * Number of triangle or edge primitives submitted for this bin.
   */
  numPrimitives: number;
}

/**
 * Render-bundle cache activity for one WebGPU frame.
 */
export interface WebGPUViewRenderBundleStats {
  /**
   * Number of render bundles recorded during the frame.
   */
  records: number;

  /**
   * Number of cached render bundles replayed during the frame.
   */
  replays: number;

  /**
   * Number of requested render-bundle submissions that fell back to direct encoding.
   */
  fallbacks: number;

  /**
   * Number of cached render bundles replaced because their batch key changed.
   */
  invalidations: number;
}

/**
 * Compact render summary for the last WebGPU frame rendered for one View.
 */
export interface WebGPUViewRenderStats {
  /**
   * Total draw calls submitted for the View.
   */
  numDrawCalls: number;

  /**
   * Total triangle or edge primitives submitted for the View.
   */
  numPrimitives: number;

  /**
   * Total packed batches submitted for the View.
   */
  numBatches: number;

  /**
   * Per-bin draw-call and primitive counts.
   */
  renderBins: WebGPUViewRenderBinStats[];

  /**
   * Render-bundle cache activity for the View.
   */
  renderBundleStats: WebGPUViewRenderBundleStats;

  /**
   * Number of RTC tiles tracked for the rendered frame.
   */
  numRTCTiles: number;

  /**
   * Number of RTC tile matrix uploads performed for the rendered frame.
   */
  numRTCTileMatrixUploads: number;

  /**
   * Number of meshes rendered with an assigned RTC tile.
   */
  numMeshesWithRTCTile: number;

  /**
   * Number of meshes rendered through the origin tile fallback.
   */
  numMeshesUsingRTCFallback: number;

  /**
   * Total measured frame CPU time, in milliseconds.
   */
  frameTimeMs: number;

  /**
   * CPU timing breakdown for the frame.
   */
  cpuTime: WebGPUViewRenderCPUTimeStats;
}
