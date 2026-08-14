import type {WebGPUDeviceDescriptor} from "./WebGPUDeviceDescriptor";
import type {WebGPUDeviceLike} from "./WebGPUDeviceLike";

/**
 * Minimal WebGPU adapter shape used by WebGPURenderer.
 */
export interface WebGPUAdapterLike {
  readonly features?: {
    has(feature: string): boolean;
  };
  requestDevice(descriptor?: WebGPUDeviceDescriptor): Promise<WebGPUDeviceLike>;
}
