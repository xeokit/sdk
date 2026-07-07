import type {WebGPUDeviceDescriptor} from "./WebGPUDeviceDescriptor";
import type {WebGPUDeviceLike} from "./WebGPUDeviceLike";

/**
 * Minimal WebGPU adapter shape used by WebGPURenderer.
 */
export interface WebGPUAdapterLike {
  requestDevice(descriptor?: WebGPUDeviceDescriptor): Promise<WebGPUDeviceLike>;
}
