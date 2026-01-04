/**
 * Interface representing GPU memory usage statistics.
 */
export interface MemoryUsage {

  /**
   * Total allocated GPU memory in megabytes (MB).
   */
  allocatedMB: number;

  /**
   * Total used GPU memory in megabytes (MB).
   */
  usedMB: number;
}
