import type {WebGPUBufferLike} from "./WebGPUBufferLike";

/**
 * Minimal WebGPU queue shape used by WebGPURenderer.
 */
export interface WebGPUQueueLike {
  submit(commandBuffers: unknown[]): void;
  writeBuffer(
    buffer: WebGPUBufferLike,
    bufferOffset: number,
    data: ArrayBuffer | ArrayBufferView,
    dataOffset?: number,
    size?: number
  ): void;
}
