/**
 * Configuration options for WebGPU render pass orchestration.
 */
export interface WebGPURenderConfigs {
  /**
   * Enables an opaque depth-only pass before opaque color rendering.
   *
   * This gives later depth-driven effects, caps, and occlusion-aware passes a
   * stable depth buffer while keeping the draw technique separate from color
   * rendering.
   */
  depthPrepass: boolean;

  /**
   * Enables edge batch construction and edge draw submission.
   */
  edges: boolean;

  /**
   * Enables optional WebGPU timestamp queries for render-pass GPU timings.
   *
   * Requires a device created with the `timestamp-query` feature. When the
   * feature is unavailable, the renderer skips GPU timing without changing
   * rendering behavior.
   */
  gpuTimestamps: boolean;

  /**
   * Selects how transparent triangle meshes are batched.
   *
   * - `"segment"` groups transparent draws by packed geometry segment. This is
   *   the faster default and mirrors WebGLRenderer's batch-oriented behavior.
   * - `"object"` preserves per-object depth-sort order, which can improve
   *   blending correctness for interleaved transparent meshes but may produce
   *   many more draw calls when sorted meshes span multiple packed segments.
   */
  transparentSortStrategy: "segment" | "object";
}
