/**
 * Interface representing GPU memory usage statistics.
 */
export interface GPUMemoryUsage {

  /**
   * Total allocated GPU memory in megabytes (MB).
   */
  allocatedMB: number;

  /**
   * Total used GPU memory in megabytes (MB).
   */
  usedMB: number;
}
