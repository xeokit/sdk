import type {WebGPURenderPassEncoderLike} from "./WebGPURenderPassEncoderLike";

/**
 * Minimal WebGPU command encoder shape used by WebGPURenderer.
 */
export interface WebGPUCommandEncoderLike {
  beginRenderPass(descriptor: unknown): WebGPURenderPassEncoderLike;
  copyTextureToBuffer?(source: unknown, destination: unknown, copySize: unknown): void;
  copyBufferToBuffer?(source: unknown, sourceOffset: number, destination: unknown, destinationOffset: number, size: number): void;
  resolveQuerySet?(querySet: unknown, firstQuery: number, queryCount: number, destination: unknown, destinationOffset: number): void;
  finish(): unknown;
}
