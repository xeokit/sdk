import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import type {WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT} from "../../../constants";
import {RENDER_PASSES, type WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {PipelineState} from "../../PipelineState";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import {encodePackedTriangleBatches} from "../triangles/PackedTriangleBatchEncoder";
import {PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS} from "../triangles/TrianglePositionPacking";
import {createPointsDrawColorShader} from "./PointsShader";

const PACKED_POINT_VERTEX_BUFFER_LAYOUTS = [
  ...PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS,
  {
    arrayStride: 4,
    attributes: [{
      shaderLocation: 2,
      offset: 0,
      format: "unorm8x4"
    }]
  }
];

/**
 * @internal
 */
export class PointsDrawColorTechnique extends DrawTechnique {
  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineStates: {[key: string]: PipelineState | undefined} = {};

  public getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<PipelineState> {
    const colorTargetFormat = this._renderContext.colorTargetFormat;
    const pipelineKey = `${renderPass}:${colorTargetFormat}`;
    const existing = this._pipelineStates[pipelineKey];
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
    const instanceBindGroupLayoutResult = this._bindGroupLayoutManager.getInstanceBindGroupLayout();
    if (instanceBindGroupLayoutResult.ok === false) {
      return instanceBindGroupLayoutResult;
    }
    try {
      this._pipelineStates[pipelineKey] = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: instanceBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        bindGroupLayoutSignature: ["frame", "instance", "trianglePositionDecode"],
        renderPipeline: this._renderContext.device.createRenderPipeline({
          label: renderPass === RENDER_PASSES.TRANSPARENT
            ? "xeokit-webgpu-points-draw-color-transparent-pipeline"
            : "xeokit-webgpu-points-draw-color-opaque-pipeline",
          layout: pipelineLayoutResult.value,
          vertex: {
            module: shaderModuleResult.value,
            entryPoint: "vs_main",
            buffers: PACKED_POINT_VERTEX_BUFFER_LAYOUTS
          },
          fragment: {
            module: shaderModuleResult.value,
            entryPoint: "fs_main",
            targets: [{
              format: colorTargetFormat,
              blend: renderPass === RENDER_PASSES.TRANSPARENT ? {
                color: {srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add"},
                alpha: {srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add"}
              } : undefined
            }]
          },
          depthStencil: {
            format: DEPTH_FORMAT,
            depthWriteEnabled: renderPass === RENDER_PASSES.OPAQUE,
            depthCompare: renderPass === RENDER_PASSES.OPAQUE ? "less-equal" : "less"
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
        error: `[PointsDrawColorTechnique.getPipelineState] Failed to create WebGPU points draw-color pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: this._pipelineStates[pipelineKey]!};
  }

  public drawBatches(params: DrawBatchesParams): SDKResult<void> {
    const {passEncoder, pipelineState, frameBindGroup, instanceBindGroup} = params;
    params.commandStateTracker.setPipeline(pipelineState);
    params.commandStateTracker.setBindGroup(0, frameBindGroup);
    params.commandStateTracker.setBindGroup(1, instanceBindGroup);
    return encodePackedTriangleBatches({
      device: this._renderContext.device,
      passEncoder,
      batches: params.batches,
      renderPass: params.renderPass,
      validateLabel: "PointsDrawColorTechnique.drawBatches",
      commandStats: params.commandStats,
      commandStateTracker: params.commandStateTracker,
      bindBeforeDraw: (packedBatch) => {
        if (packedBatch.colorBuffer) {
          params.commandStateTracker.setVertexBuffer(2, packedBatch.colorBuffer, packedBatch.colorBufferOffset ?? 0);
        }
      }
    });
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
        label: "xeokit-webgpu-points-draw-color-shader",
        code: createPointsDrawColorShader()
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[PointsDrawColorTechnique._getShaderModule] Failed to create WebGPU points draw-color shader module: ${e instanceof Error ? e.message : String(e)}`
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
        label: "xeokit-webgpu-points-draw-color-pipeline-layout",
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
        error: `[PointsDrawColorTechnique._getPipelineLayout] Failed to create WebGPU points draw-color pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: this._pipelineLayout};
  }
}
