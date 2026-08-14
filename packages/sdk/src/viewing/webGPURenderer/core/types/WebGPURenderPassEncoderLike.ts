import type {WebGPUBindGroupLike} from "./WebGPUBindGroupLike";
import type {WebGPUBufferLike} from "./WebGPUBufferLike";
import type {WebGPURenderPipelineLike} from "./WebGPURenderPipelineLike";

/**
 * Minimal WebGPU render pass encoder shape used by WebGPURenderer.
 */
export interface WebGPURenderPassEncoderLike {
  setPipeline?(pipeline: WebGPURenderPipelineLike): void;
  setVertexBuffer?(slot: number, buffer: WebGPUBufferLike, offset?: number): void;
  setIndexBuffer?(buffer: WebGPUBufferLike, indexFormat: "uint16" | "uint32", offset?: number): void;
  setBindGroup?(index: number, bindGroup: WebGPUBindGroupLike): void;
  drawIndexed?(indexCount: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number): void;
  draw?(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  end?(): void;
  endPass?(): void;
}
