import type {WebGPUDeviceDescriptor} from "./WebGPUDeviceDescriptor";
import type {WebGPUDeviceLike} from "./WebGPUDeviceLike";

/**
 * Minimal WebGPU adapter shape used by WebGPURenderer.
 *
 * Use this when injecting a custom adapter into {@link WebGPURenderer.create}
 * without requiring ambient WebGPU DOM typings.
 */
export interface WebGPUAdapterLike {
  /**
   * Adapter limits available before device creation.
   */
  readonly limits?: {
    readonly maxStorageBufferBindingSize?: number;
  };

  /**
   * Adapter feature set queried before requesting optional renderer features.
   */
  readonly features?: {
    /**
     * Returns whether the adapter exposes the named WebGPU feature.
     */
    has(feature: string): boolean;
  };

  /**
   * Requests a WebGPU device from this adapter.
   *
   * @param descriptor - Optional device descriptor passed through by the renderer.
   * @returns Promise resolving to a WebGPU-compatible device.
   */
  requestDevice(descriptor?: WebGPUDeviceDescriptor): Promise<WebGPUDeviceLike>;
}
