import {SDKErrorType, type SDKResult} from "../../../../../../../base/core";
import type {WebGPUBindGroupLike, WebGPUBindGroupLayoutLike, WebGPUBufferLike, WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT, GPU_BUFFER_USAGE, GPU_SHADER_STAGE} from "../../../constants";
import {RENDER_PASSES} from "../../../RENDER_PASSES";
import type {WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {PipelineState} from "../../PipelineState";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import {encodePackedTriangleBatches} from "./PackedTriangleBatchEncoder";
import {TRIANGLES_STENCIL_MASK_SHADER} from "./TrianglesStencilMaskShader";
import {PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS} from "./TrianglePositionPacking";

/**
 * WebGPU stencil-mask technique used by section-plane caps.
 *
 * @internal
 */
export class TrianglesStencilMaskTechnique extends DrawTechnique {

  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _capParamsLayout: WebGPUBindGroupLayoutLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineStates: {[key: string]: PipelineState | undefined} = {};
  private _capParamsBuffer: WebGPUBufferLike | null = null;
  private _capParamsBindGroup: WebGPUBindGroupLike | null = null;
  private readonly _capParamsData = new Float32Array(4);

  public setCapPlaneIndex(index: number): SDKResult<void> {
    const bindGroupResult = this._getOrCreateCapParamsBindGroup();
    if (bindGroupResult.ok === false) {
      return bindGroupResult;
    }
    this._capParamsData[0] = index;
    this._renderContext.device.queue.writeBuffer(this._capParamsBuffer!, 0, this._capParamsData);
    return {
      ok: true,
      value: undefined
    };
  }

  public getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<PipelineState> {
    return this._getPipelineState(renderPass === RENDER_PASSES.STENCIL_MASK_BACK ? "back" : "front");
  }

  public getFrontPipelineState(): SDKResult<PipelineState> {
    return this._getPipelineState("front");
  }

  public getBackPipelineState(): SDKResult<PipelineState> {
    return this._getPipelineState("back");
  }

  public drawBatches(params: DrawBatchesParams): SDKResult<void> {
    const capParamsBindGroupResult = this._getOrCreateCapParamsBindGroup();
    if (capParamsBindGroupResult.ok === false) {
      return capParamsBindGroupResult;
    }
    const {passEncoder, pipelineState, frameBindGroup, instanceBindGroup, batches} = params;
    if (!passEncoder.setPipeline || !passEncoder.setVertexBuffer || !passEncoder.setIndexBuffer || !passEncoder.setBindGroup || !passEncoder.drawIndexed) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[TrianglesStencilMaskTechnique.drawBatches] WebGPU render pass encoder does not expose indexed drawing methods."
      };
    }
    params.commandStateTracker.setPipeline(pipelineState);
    params.commandStateTracker.setBindGroup(0, frameBindGroup);
    params.commandStateTracker.setBindGroup(1, instanceBindGroup);
    params.commandStateTracker.setBindGroup(3, capParamsBindGroupResult.value);
    return encodePackedTriangleBatches({
      device: this._renderContext.device,
      passEncoder,
      batches,
      renderPass: params.renderPass,
      validateLabel: "TrianglesStencilMaskTechnique.drawBatches",
      commandStats: params.commandStats,
      commandStateTracker: params.commandStateTracker
    });
  }

  public override destroy(): void {
    try {
      this._capParamsBuffer?.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
    }
    this._shaderModule = null;
    this._capParamsLayout = null;
    this._pipelineLayout = null;
    this._pipelineStates = {};
    this._capParamsBuffer = null;
    this._capParamsBindGroup = null;
  }

  private _getPipelineState(face: "front" | "back"): SDKResult<PipelineState> {
    const colorTargetFormat = this._renderContext.colorTargetFormat;
    const pipelineKey = `${face}:${colorTargetFormat}`;
    const cached = this._pipelineStates[pipelineKey];
    if (cached) {
      return {
        ok: true,
        value: cached
      };
    }
    const shaderModuleResult = this._getShaderModule();
    if (shaderModuleResult.ok === false) {
      return shaderModuleResult;
    }
    const frameBindGroupLayoutResult = this._bindGroupLayoutManager.getFrameBindGroupLayout();
    if (frameBindGroupLayoutResult.ok === false) {
      return frameBindGroupLayoutResult;
    }
    const instanceBindGroupLayoutResult = this._bindGroupLayoutManager.getInstanceBindGroupLayout();
    if (instanceBindGroupLayoutResult.ok === false) {
      return instanceBindGroupLayoutResult;
    }
    const pipelineLayoutResult = this._getPipelineLayout();
    if (pipelineLayoutResult.ok === false) {
      return pipelineLayoutResult;
    }
    try {
      const renderPipeline = this._renderContext.device.createRenderPipeline({
        label: `xeokit-webgpu-triangles-stencil-mask-${face}-pipeline`,
        layout: pipelineLayoutResult.value,
        vertex: {
          module: shaderModuleResult.value,
          entryPoint: "vs_main",
          buffers: PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS
        },
        fragment: {
          module: shaderModuleResult.value,
          entryPoint: "fs_main",
          targets: [{
            format: colorTargetFormat,
            writeMask: 0
          }]
        },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: false,
          depthCompare: "always",
          stencilFront: {
            compare: "always",
            failOp: "keep",
            depthFailOp: "keep",
            passOp: face === "front" ? "decrement-wrap" : "increment-wrap"
          },
          stencilBack: {
            compare: "always",
            failOp: "keep",
            depthFailOp: "keep",
            passOp: face === "front" ? "decrement-wrap" : "increment-wrap"
          }
        },
        primitive: {
          topology: "triangle-list",
          cullMode: face === "front" ? "back" : "front"
        }
      });
      const pipelineState = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: instanceBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        renderPipeline,
        bindGroupLayoutSignature: ["frame", "instance", "trianglePositionDecode", "sectionPlaneCapParams"]
      };
      this._pipelineStates[pipelineKey] = pipelineState;
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesStencilMaskTechnique._getPipelineState] Failed to create WebGPU triangles stencil-mask pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._pipelineStates[pipelineKey]!
    };
  }

  private _getShaderModule(): SDKResult<WebGPUShaderModuleLike> {
    if (this._shaderModule) {
      return {
        ok: true,
        value: this._shaderModule
      };
    }
    try {
      this._shaderModule = this._renderContext.device.createShaderModule({
        label: "xeokit-webgpu-triangles-stencil-mask-shader",
        code: TRIANGLES_STENCIL_MASK_SHADER
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesStencilMaskTechnique._getShaderModule] Failed to create WebGPU triangles stencil-mask shader module: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._shaderModule
    };
  }

  private _getCapParamsLayout(): SDKResult<WebGPUBindGroupLayoutLike> {
    if (this._capParamsLayout) {
      return {
        ok: true,
        value: this._capParamsLayout
      };
    }
    try {
      this._capParamsLayout = this._renderContext.device.createBindGroupLayout({
        label: "xeokit-webgpu-cap-params-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesStencilMaskTechnique._getCapParamsLayout] Failed to create WebGPU cap params bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._capParamsLayout
    };
  }

  private _getPipelineLayout(): SDKResult<WebGPUPipelineLayoutLike> {
    if (this._pipelineLayout) {
      return {
        ok: true,
        value: this._pipelineLayout
      };
    }
    const frameBindGroupLayoutResult = this._bindGroupLayoutManager.getFrameBindGroupLayout();
    if (frameBindGroupLayoutResult.ok === false) {
      return frameBindGroupLayoutResult;
    }
    const instanceBindGroupLayoutResult = this._bindGroupLayoutManager.getInstanceBindGroupLayout();
    if (instanceBindGroupLayoutResult.ok === false) {
      return instanceBindGroupLayoutResult;
    }
    const positionDecodeBindGroupLayoutResult = this._bindGroupLayoutManager.getTrianglePositionDecodeBindGroupLayout();
    if (positionDecodeBindGroupLayoutResult.ok === false) {
      return positionDecodeBindGroupLayoutResult;
    }
    const capParamsLayoutResult = this._getCapParamsLayout();
    if (capParamsLayoutResult.ok === false) {
      return capParamsLayoutResult;
    }
    try {
      this._pipelineLayout = this._renderContext.device.createPipelineLayout({
        label: "xeokit-webgpu-triangles-stencil-mask-pipeline-layout",
        bindGroupLayouts: [
          frameBindGroupLayoutResult.value,
          instanceBindGroupLayoutResult.value,
          positionDecodeBindGroupLayoutResult.value,
          capParamsLayoutResult.value
        ]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesStencilMaskTechnique._getPipelineLayout] Failed to create WebGPU triangles stencil-mask pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._pipelineLayout
    };
  }

  private _getOrCreateCapParamsBindGroup(): SDKResult<WebGPUBindGroupLike> {
    if (this._capParamsBindGroup) {
      return {
        ok: true,
        value: this._capParamsBindGroup
      };
    }
    const capParamsLayoutResult = this._getCapParamsLayout();
    if (capParamsLayoutResult.ok === false) {
      return capParamsLayoutResult;
    }
    try {
      this._capParamsBuffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-cap-params-uniforms",
        size: this._capParamsData.byteLength,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      this._capParamsBindGroup = this._renderContext.device.createBindGroup({
        label: "xeokit-webgpu-cap-params-bind-group",
        layout: capParamsLayoutResult.value,
        entries: [{
          binding: 0,
          resource: {
            buffer: this._capParamsBuffer
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesStencilMaskTechnique._getOrCreateCapParamsBindGroup] Failed to create WebGPU cap params bind group: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._capParamsBindGroup
    };
  }
}
