import type {WebGPUBindGroupLayoutLike} from "./WebGPUBindGroupLayoutLike";
import type {WebGPUBindGroupLike} from "./WebGPUBindGroupLike";
import type {WebGPUBufferLike} from "./WebGPUBufferLike";
import type {WebGPUCommandEncoderLike} from "./WebGPUCommandEncoderLike";
import type {WebGPUDeviceLostInfoLike} from "./WebGPUDeviceLostInfoLike";
import type {WebGPUPipelineLayoutLike} from "./WebGPUPipelineLayoutLike";
import type {WebGPUQueueLike} from "./WebGPUQueueLike";
import type {WebGPURenderPipelineLike} from "./WebGPURenderPipelineLike";
import type {WebGPUShaderModuleLike} from "./WebGPUShaderModuleLike";
import type {WebGPUTextureLike} from "./WebGPUTextureLike";

export interface WebGPUQuerySetLike {
  destroy?(): void;
}

/**
 * Minimal WebGPU device shape used by WebGPURenderer.
 */
export interface WebGPUDeviceLike {
  readonly queue: WebGPUQueueLike;
  readonly lost?: Promise<WebGPUDeviceLostInfoLike>;
  readonly features?: {
    has(feature: string): boolean;
  };
  createBuffer(descriptor: object): WebGPUBufferLike;
  createTexture(descriptor: object): WebGPUTextureLike;
  createQuerySet?(descriptor: object): WebGPUQuerySetLike;
  createShaderModule(descriptor: object): WebGPUShaderModuleLike;
  createBindGroupLayout(descriptor: object): WebGPUBindGroupLayoutLike;
  createPipelineLayout(descriptor: object): WebGPUPipelineLayoutLike;
  createRenderPipeline(descriptor: object): WebGPURenderPipelineLike;
  createBindGroup(descriptor: object): WebGPUBindGroupLike;
  createCommandEncoder(): WebGPUCommandEncoderLike;
  destroy?(): void;
}
