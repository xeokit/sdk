import {SDKErrorType, type SDKResult} from "../../../../../../../base/core";
import type {WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT} from "../../../constants";
import {RENDER_PASSES, type WebGPURenderPassValue} from "../../../RENDER_PASSES";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import type {PipelineState} from "../../PipelineState";
import {createSplatsDrawColorShader} from "./SplatsShader";

/**
 * @internal
 */
export class SplatsDrawColorTechnique extends DrawTechnique {
  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineStates: {[format: string]: PipelineState | undefined} = {};

  public getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<PipelineState> {
    void renderPass;
    const colorTargetFormat = this._renderContext.colorTargetFormat;
    const existing = this._pipelineStates[colorTargetFormat];
    if (existing) {
      return {ok: true, value: existing};
    }
    const shaderModuleResult = this._getShaderModule();
    if (shaderModuleResult.ok === false) {
      return shaderModuleResult;
    }
    const pipelineLayoutResult = this._getPipelineLayout();
    if (pipelineLayoutResult.ok === false) {
      return pipelineLayoutResult;
    }
    const frameBindGroupLayoutResult = this._bindGroupLayoutManager.getFrameBindGroupLayout();
    if (frameBindGroupLayoutResult.ok === false) {
      return frameBindGroupLayoutResult;
    }
    const splatBindGroupLayoutResult = this._bindGroupLayoutManager.getSplatBindGroupLayout();
    if (splatBindGroupLayoutResult.ok === false) {
      return splatBindGroupLayoutResult;
    }
    try {
      this._pipelineStates[colorTargetFormat] = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: splatBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        bindGroupLayoutSignature: ["frame", "splat"],
        renderPipeline: this._renderContext.device.createRenderPipeline({
          label: "xeokit-webgpu-splats-draw-color-pipeline",
          layout: pipelineLayoutResult.value,
          vertex: {
            module: shaderModuleResult.value,
            entryPoint: "vs_main",
            buffers: []
          },
          fragment: {
            module: shaderModuleResult.value,
            entryPoint: "fs_main",
            targets: [{
              format: colorTargetFormat,
              blend: {
                color: {srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add"},
                alpha: {srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add"}
              }
            }]
          },
          depthStencil: {
            format: DEPTH_FORMAT,
            depthWriteEnabled: false,
            depthCompare: "less"
          },
          primitive: {
            topology: "triangle-list",
            cullMode: "none"
          }
        })
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SplatsDrawColorTechnique.getPipelineState] Failed to create WebGPU splats draw-color pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: this._pipelineStates[colorTargetFormat]!};
  }

  public drawBatches(params: DrawBatchesParams): SDKResult<void> {
    const {pipelineState, frameBindGroup} = params;
    params.commandStateTracker.setPipeline(pipelineState);
    params.commandStateTracker.setBindGroup(0, frameBindGroup);
    for (let i = 0, len = params.batches.length; i < len; i++) {
      const packedBatch = params.batches[i].packedBatch;
      if (!packedBatch.splatBindGroup || !packedBatch.splatCount) {
        continue;
      }
      params.commandStateTracker.setBindGroup(1, packedBatch.splatBindGroup);
      params.commandStateTracker.draw(6, packedBatch.splatCount, 0, 0);
    }
    return {ok: true, value: undefined};
  }

  public destroy(): void {
    this._shaderModule = null;
    this._pipelineLayout = null;
    this._pipelineStates = {};
  }

  private _getShaderModule(): SDKResult<WebGPUShaderModuleLike> {
    if (this._shaderModule) {
      return {ok: true, value: this._shaderModule};
    }
    try {
      this._shaderModule = this._renderContext.device.createShaderModule({
        label: "xeokit-webgpu-splats-draw-color-shader",
        code: createSplatsDrawColorShader()
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SplatsDrawColorTechnique._getShaderModule] Failed to create WebGPU splats draw-color shader module: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: this._shaderModule};
  }

  private _getPipelineLayout(): SDKResult<WebGPUPipelineLayoutLike> {
    if (this._pipelineLayout) {
      return {ok: true, value: this._pipelineLayout};
    }
    const frameBindGroupLayoutResult = this._bindGroupLayoutManager.getFrameBindGroupLayout();
    if (frameBindGroupLayoutResult.ok === false) {
      return frameBindGroupLayoutResult;
    }
    const splatBindGroupLayoutResult = this._bindGroupLayoutManager.getSplatBindGroupLayout();
    if (splatBindGroupLayoutResult.ok === false) {
      return splatBindGroupLayoutResult;
    }
    try {
      this._pipelineLayout = this._renderContext.device.createPipelineLayout({
        label: "xeokit-webgpu-splats-draw-color-pipeline-layout",
        bindGroupLayouts: [
          frameBindGroupLayoutResult.value,
          splatBindGroupLayoutResult.value
        ]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SplatsDrawColorTechnique._getPipelineLayout] Failed to create WebGPU splats draw-color pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: this._pipelineLayout};
  }
}
