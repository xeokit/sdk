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

/** @internal */
export type WebGPUSamplerLike = object;

/** @internal */
export interface WebGPUQuerySetLike {
  destroy?(): void;
}

/**
 * Minimal WebGPU device shape used by WebGPURenderer.
 *
 * Use this when injecting a custom device into {@link WebGPURenderer} or
 * {@link WebGPURenderer.create} without requiring ambient WebGPU DOM typings.
 */
export interface WebGPUDeviceLike {
  /**
   * Queue used by the renderer for buffer writes, texture writes, and command submission.
   */
  readonly queue: WebGPUQueueLike;

  /**
   * Optional WebGPU device-lost promise.
   */
  readonly lost?: Promise<WebGPUDeviceLostInfoLike>;

  /**
   * Device feature set queried before using optional renderer features.
   */
  readonly features?: {
    /**
     * Returns whether the device exposes the named WebGPU feature.
     */
    has(feature: string): boolean;
  };

  /**
   * Creates a GPU buffer.
   */
  createBuffer(descriptor: object): WebGPUBufferLike;

  /**
   * Creates a GPU texture.
   */
  createTexture(descriptor: object): WebGPUTextureLike;

  /**
   * Creates a GPU query set, when supported by the device.
   */
  createQuerySet?(descriptor: object): WebGPUQuerySetLike;

  /**
   * Creates a shader module.
   */
  createShaderModule(descriptor: object): WebGPUShaderModuleLike;

  /**
   * Creates a bind group layout.
   */
  createBindGroupLayout(descriptor: object): WebGPUBindGroupLayoutLike;

  /**
   * Creates a pipeline layout.
   */
  createPipelineLayout(descriptor: object): WebGPUPipelineLayoutLike;

  /**
   * Creates a render pipeline.
   */
  createRenderPipeline(descriptor: object): WebGPURenderPipelineLike;

  /**
   * Creates a bind group.
   */
  createBindGroup(descriptor: object): WebGPUBindGroupLike;

  /**
   * Creates a sampler, when supported by the device.
   */
  createSampler?(descriptor: object): WebGPUSamplerLike;

  /**
   * Creates a command encoder for one or more render passes.
   */
  createCommandEncoder(): WebGPUCommandEncoderLike;

  /**
   * Releases the device when the injected or acquired device owner allows destruction.
   */
  destroy?(): void;
}
