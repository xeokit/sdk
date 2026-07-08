import type {
  WebGPUBindGroupLayoutLike,
  WebGPUPipelineLayoutLike,
  WebGPURenderPipelineLike,
  WebGPUShaderModuleLike
} from "../../core";

export interface WebGPUPipelineState {
  shaderModule: WebGPUShaderModuleLike;
  frameBindGroupLayout: WebGPUBindGroupLayoutLike;
  instanceBindGroupLayout: WebGPUBindGroupLayoutLike;
  pipelineLayout: WebGPUPipelineLayoutLike;
  renderPipeline: WebGPURenderPipelineLike;
}
