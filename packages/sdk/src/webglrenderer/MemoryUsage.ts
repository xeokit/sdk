/**
 * Represents GPU memory usage statistics for a WebGLRenderer.
 */
export interface MemoryUsage {

  /**
   * Total GPU memory allocated by the WebGLRenderer, in megabytes (MB).
   */
  allocatedMB: number;

  /**
   * Total GPU memory actively used by the WebGLRenderer, in megabytes (MB).
   */
  usedMB: number;
}
