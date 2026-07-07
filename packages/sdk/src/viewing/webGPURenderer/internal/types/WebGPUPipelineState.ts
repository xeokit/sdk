import type {
  WebGPUBindGroupLayoutLike,
  WebGPUPipelineLayoutLike,
  WebGPURenderPipelineLike,
  WebGPUShaderModuleLike
} from "../../core";

export interface WebGPUPipelineState {
  shaderModule: WebGPUShaderModuleLike;
  frameBindGroupLayout: WebGPUBindGroupLayoutLike;
  pipelineLayout: WebGPUPipelineLayoutLike;
  renderPipeline: WebGPURenderPipelineLike;
}
