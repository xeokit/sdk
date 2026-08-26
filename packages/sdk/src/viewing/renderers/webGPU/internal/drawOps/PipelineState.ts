import type {
  WebGPUBindGroupLayoutLike,
  WebGPUPipelineLayoutLike,
  WebGPURenderPipelineLike,
  WebGPUShaderModuleLike
} from "../../core";

export interface PipelineState {
  shaderModule: WebGPUShaderModuleLike;
  frameBindGroupLayout: WebGPUBindGroupLayoutLike;
  instanceBindGroupLayout: WebGPUBindGroupLayoutLike;
  pipelineLayout: WebGPUPipelineLayoutLike;
  renderPipeline: WebGPURenderPipelineLike;
  bindGroupLayoutSignature: readonly string[];
}
