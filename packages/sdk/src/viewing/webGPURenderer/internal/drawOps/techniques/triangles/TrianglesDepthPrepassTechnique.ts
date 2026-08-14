import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import type {WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT} from "../../../constants";
import type {WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {PipelineState} from "../../PipelineState";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import {encodePackedTriangleBatches} from "./PackedTriangleBatchEncoder";
import {TRIANGLES_DEPTH_PREPASS_SHADER} from "./TrianglesDepthPrepassShader";
import {PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS} from "./TrianglePositionPacking";

/**
 * WebGPU draw technique for indexed triangle depth prepasses.
 *
 * @internal
 */
export class TrianglesDepthPrepassTechnique extends DrawTechnique {

  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineState: PipelineState | null = null;

  public getPipelineState(_renderPass: WebGPURenderPassValue): SDKResult<PipelineState> {
    if (this._pipelineState) {
      return {
        ok: true,
        value: this._pipelineState
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
        label: "xeokit-webgpu-triangles-depth-prepass-pipeline",
        layout: pipelineLayoutResult.value,
        vertex: {
          module: shaderModuleResult.value,
          entryPoint: "vs_main",
          buffers: PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS
        },
        fragment: {
          module: shaderModuleResult.value,
          entryPoint: "fs_main",
          targets: []
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
      });

      this._pipelineState = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: instanceBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        renderPipeline,
        bindGroupLayoutSignature: ["frame", "instance", "trianglePositionDecode"]
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesDepthPrepassTechnique.getPipelineState] Failed to create WebGPU triangles depth-prepass pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._pipelineState
    };
  }

  public drawBatches(params: DrawBatchesParams): SDKResult<void> {
    const {passEncoder, pipelineState, frameBindGroup, instanceBindGroup, batches} = params;

    if (
      !passEncoder.setPipeline ||
      !passEncoder.setVertexBuffer ||
      !passEncoder.setIndexBuffer ||
      !passEncoder.setBindGroup ||
      !passEncoder.drawIndexed
    ) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[TrianglesDepthPrepassTechnique.drawBatches] WebGPU render pass encoder does not expose indexed drawing methods."
      };
    }

    params.commandStateTracker.setPipeline(pipelineState);
    params.commandStateTracker.setBindGroup(0, frameBindGroup);
    params.commandStateTracker.setBindGroup(1, instanceBindGroup);

    return encodePackedTriangleBatches({
      device: this._renderContext.device,
      passEncoder,
      batches,
      renderPass: params.renderPass,
      validateLabel: "TrianglesDepthPrepassTechnique.drawBatches",
      commandStats: params.commandStats,
      commandStateTracker: params.commandStateTracker
    });
  }

  public destroy(): void {
    this._shaderModule = null;
    this._pipelineLayout = null;
    this._pipelineState = null;
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
        label: "xeokit-webgpu-triangles-depth-prepass-shader",
        code: TRIANGLES_DEPTH_PREPASS_SHADER
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesDepthPrepassTechnique._getShaderModule] Failed to create WebGPU triangles depth-prepass shader module: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._shaderModule
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

    try {
      this._pipelineLayout = this._renderContext.device.createPipelineLayout({
        label: "xeokit-webgpu-triangles-depth-prepass-pipeline-layout",
        bindGroupLayouts: [
          frameBindGroupLayoutResult.value,
          instanceBindGroupLayoutResult.value,
          positionDecodeBindGroupLayoutResult.value
        ]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesDepthPrepassTechnique._getPipelineLayout] Failed to create WebGPU triangles depth-prepass pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._pipelineLayout
    };
  }
}
