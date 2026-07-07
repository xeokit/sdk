import type {WebGPURenderPassEncoderLike} from "./WebGPURenderPassEncoderLike";

/**
 * Minimal WebGPU command encoder shape used by WebGPURenderer.
 */
export interface WebGPUCommandEncoderLike {
  beginRenderPass(descriptor: unknown): WebGPURenderPassEncoderLike;
  finish(): unknown;
}
