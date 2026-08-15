import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import type {WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT, ID_BUFFER_FORMAT} from "../../../constants";
import type {WebGPURenderPassValue} from "../../../RENDER_PASSES";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import type {PipelineState} from "../../PipelineState";
import {createSplatsPickShader} from "./SplatsShader";

/**
 * @internal
 */
export class SplatsPickTechnique extends DrawTechnique {
  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineState: PipelineState | null = null;

  public getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<PipelineState> {
    void renderPass;
    if (this._pipelineState) {
      return {ok: true, value: this._pipelineState};
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
      this._pipelineState = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: splatBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        bindGroupLayoutSignature: ["frame", "splat"],
        renderPipeline: this._renderContext.device.createRenderPipeline({
          label: "xeokit-webgpu-splats-pick-pipeline",
          layout: pipelineLayoutResult.value,
          vertex: {
            module: shaderModuleResult.value,
            entryPoint: "vs_main",
            buffers: []
          },
          fragment: {
            module: shaderModuleResult.value,
            entryPoint: "fs_main",
            targets: [{format: ID_BUFFER_FORMAT}]
          },
          depthStencil: {
            format: DEPTH_FORMAT,
            depthWriteEnabled: true,
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
        error: `[SplatsPickTechnique.getPipelineState] Failed to create WebGPU splats pick pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: this._pipelineState};
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
    this._pipelineState = null;
  }

  private _getShaderModule(): SDKResult<WebGPUShaderModuleLike> {
    if (this._shaderModule) {
      return {ok: true, value: this._shaderModule};
    }
    try {
      this._shaderModule = this._renderContext.device.createShaderModule({
        label: "xeokit-webgpu-splats-pick-shader",
        code: createSplatsPickShader()
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SplatsPickTechnique._getShaderModule] Failed to create WebGPU splats pick shader module: ${e instanceof Error ? e.message : String(e)}`
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
        label: "xeokit-webgpu-splats-pick-pipeline-layout",
        bindGroupLayouts: [
          frameBindGroupLayoutResult.value,
          splatBindGroupLayoutResult.value
        ]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SplatsPickTechnique._getPipelineLayout] Failed to create WebGPU splats pick pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: this._pipelineLayout};
  }
}
