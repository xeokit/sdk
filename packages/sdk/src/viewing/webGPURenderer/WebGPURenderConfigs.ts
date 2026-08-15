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
   * Enables logarithmic depth writes for packed triangle draws.
   *
   * This improves depth precision for large scenes with very distant camera
   * far planes, at the cost of disabling early-Z for affected fragment
   * shaders. Disabled by default.
   */
  logDepth: boolean;

  /**
   * Enables edge batch construction and edge draw submission.
   */
  edges: boolean;

  /**
   * Selects the triangle color path.
   *
   * - `"pbr"` uploads material, normal and texture coordinate streams for
   *   physically based shading.
   * - `"flat"` uploads only the streams needed for unlit per-object color.
   *   This is intended for very large streamed models that would otherwise
   *   exceed available GPU memory.
   */
  triangleColorMode: "pbr" | "flat";

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
