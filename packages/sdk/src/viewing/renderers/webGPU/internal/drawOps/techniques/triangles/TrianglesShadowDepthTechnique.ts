import {SDKErrorType, type SDKResult} from "../../../../../../../base/core";
import type {WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {SHADOW_DEPTH_FORMAT} from "../../../constants";
import type {WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {PipelineState} from "../../PipelineState";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import {encodePackedTriangleBatches} from "./PackedTriangleBatchEncoder";
import {TRIANGLES_MASKED_SHADOW_DEPTH_SHADER, TRIANGLES_SHADOW_DEPTH_SHADER} from "./TrianglesShadowDepthShader";
import {PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS} from "./TrianglePositionPacking";

const PACKED_TRIANGLE_MASKED_SHADOW_VERTEX_BUFFER_LAYOUTS = [
  ...PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS,
  {
    arrayStride: 8,
    attributes: [{
      shaderLocation: 2,
      offset: 0,
      format: "float32x2"
    }]
  },
  {
    arrayStride: 48,
    attributes: [{
      shaderLocation: 3,
      offset: 0,
      format: "float32x4"
    }, {
      shaderLocation: 4,
      offset: 16,
      format: "float32x4"
    }, {
      shaderLocation: 8,
      offset: 32,
      format: "float32x4"
    }]
  }
];

/**
 * WebGPU draw technique for the triangle shadow-map depth pass.
 *
 * @internal
 */
export class TrianglesShadowDepthTechnique extends DrawTechnique {

  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _maskedShaderModule: WebGPUShaderModuleLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _maskedPipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineState: PipelineState | null = null;
  private _maskedPipelineState: PipelineState | null = null;

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
        label: "xeokit-webgpu-triangles-shadow-depth-pipeline",
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
          format: SHADOW_DEPTH_FORMAT,
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
        error: `[TrianglesShadowDepthTechnique.getPipelineState] Failed to create WebGPU triangles shadow-depth pipeline: ${e instanceof Error ? e.message : String(e)}`
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
        error: "[TrianglesShadowDepthTechnique.drawBatches] WebGPU render pass encoder does not expose indexed drawing methods."
      };
    }

    const unmaskedBatches = batches.filter((batch) => !isAlphaMaskedShadowBatch(batch));
    const maskedBatches = batches.filter(isAlphaMaskedShadowBatch);

    if (unmaskedBatches.length > 0) {
      params.commandStateTracker.setPipeline(pipelineState);
      params.commandStateTracker.setBindGroup(0, frameBindGroup);
      params.commandStateTracker.setBindGroup(1, instanceBindGroup);

      const unmaskedResult = encodePackedTriangleBatches({
        device: this._renderContext.device,
        passEncoder,
        batches: unmaskedBatches,
        renderPass: params.renderPass,
        validateLabel: "TrianglesShadowDepthTechnique.drawBatches",
        commandStats: params.commandStats,
        commandStateTracker: params.commandStateTracker
      });
      if (unmaskedResult.ok === false) {
        return unmaskedResult;
      }
    }

    if (maskedBatches.length === 0) {
      return {
        ok: true,
        value: undefined
      };
    }

    const maskedPipelineStateResult = this._getMaskedPipelineState();
    if (maskedPipelineStateResult.ok === false) {
      return maskedPipelineStateResult;
    }
    params.commandStateTracker.setPipeline(maskedPipelineStateResult.value);
    params.commandStateTracker.setBindGroup(0, frameBindGroup);
    params.commandStateTracker.setBindGroup(1, instanceBindGroup);

    return encodePackedTriangleBatches({
      device: this._renderContext.device,
      passEncoder,
      batches: maskedBatches,
      renderPass: params.renderPass,
      validateLabel: "TrianglesShadowDepthTechnique.drawBatches",
      bindBeforeDraw: (packedBatch) => {
        if (packedBatch.uvBuffer) {
          const uvBufferOffset = packedBatch.indicesPageLocal ? 0 : (packedBatch.uvBufferOffset ?? 0);
          params.commandStateTracker.setVertexBuffer(2, packedBatch.uvBuffer, uvBufferOffset);
        }
        if (packedBatch.materialBuffer) {
          const materialBufferOffset = packedBatch.indicesPageLocal ? 0 : (packedBatch.materialBufferOffset ?? 0);
          params.commandStateTracker.setVertexBuffer(3, packedBatch.materialBuffer, materialBufferOffset);
        }
        if (packedBatch.colorBindGroup) {
          params.commandStateTracker.setBindGroup(3, packedBatch.colorBindGroup);
        }
      },
      commandStats: params.commandStats,
      commandStateTracker: params.commandStateTracker
    });
  }

  public destroy(): void {
    this._shaderModule = null;
    this._maskedShaderModule = null;
    this._pipelineLayout = null;
    this._maskedPipelineLayout = null;
    this._pipelineState = null;
    this._maskedPipelineState = null;
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
        label: "xeokit-webgpu-triangles-shadow-depth-shader",
        code: TRIANGLES_SHADOW_DEPTH_SHADER
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesShadowDepthTechnique._getShaderModule] Failed to create WebGPU triangles shadow-depth shader module: ${e instanceof Error ? e.message : String(e)}`
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
        label: "xeokit-webgpu-triangles-shadow-depth-pipeline-layout",
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
        error: `[TrianglesShadowDepthTechnique._getPipelineLayout] Failed to create WebGPU triangles shadow-depth pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._pipelineLayout
    };
  }

  private _getMaskedPipelineState(): SDKResult<PipelineState> {
    if (this._maskedPipelineState) {
      return {
        ok: true,
        value: this._maskedPipelineState
      };
    }

    const shaderModuleResult = this._getMaskedShaderModule();
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
    const pipelineLayoutResult = this._getMaskedPipelineLayout();
    if (pipelineLayoutResult.ok === false) {
      return pipelineLayoutResult;
    }

    try {
      const renderPipeline = this._renderContext.device.createRenderPipeline({
        label: "xeokit-webgpu-triangles-masked-shadow-depth-pipeline",
        layout: pipelineLayoutResult.value,
        vertex: {
          module: shaderModuleResult.value,
          entryPoint: "vs_main",
          buffers: PACKED_TRIANGLE_MASKED_SHADOW_VERTEX_BUFFER_LAYOUTS
        },
        fragment: {
          module: shaderModuleResult.value,
          entryPoint: "fs_main",
          targets: []
        },
        depthStencil: {
          format: SHADOW_DEPTH_FORMAT,
          depthWriteEnabled: true,
          depthCompare: "less"
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none"
        }
      });

      this._maskedPipelineState = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: instanceBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        renderPipeline,
        bindGroupLayoutSignature: ["frame", "instance", "trianglePositionDecode", "triangleColor"]
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesShadowDepthTechnique._getMaskedPipelineState] Failed to create WebGPU triangles masked shadow-depth pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._maskedPipelineState
    };
  }

  private _getMaskedShaderModule(): SDKResult<WebGPUShaderModuleLike> {
    if (this._maskedShaderModule) {
      return {
        ok: true,
        value: this._maskedShaderModule
      };
    }

    try {
      this._maskedShaderModule = this._renderContext.device.createShaderModule({
        label: "xeokit-webgpu-triangles-masked-shadow-depth-shader",
        code: TRIANGLES_MASKED_SHADOW_DEPTH_SHADER
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesShadowDepthTechnique._getMaskedShaderModule] Failed to create WebGPU triangles masked shadow-depth shader module: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._maskedShaderModule
    };
  }

  private _getMaskedPipelineLayout(): SDKResult<WebGPUPipelineLayoutLike> {
    if (this._maskedPipelineLayout) {
      return {
        ok: true,
        value: this._maskedPipelineLayout
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
    const triangleColorBindGroupLayoutResult = this._bindGroupLayoutManager.getTriangleColorBindGroupLayout();
    if (triangleColorBindGroupLayoutResult.ok === false) {
      return triangleColorBindGroupLayoutResult;
    }

    try {
      this._maskedPipelineLayout = this._renderContext.device.createPipelineLayout({
        label: "xeokit-webgpu-triangles-masked-shadow-depth-pipeline-layout",
        bindGroupLayouts: [
          frameBindGroupLayoutResult.value,
          instanceBindGroupLayoutResult.value,
          positionDecodeBindGroupLayoutResult.value,
          triangleColorBindGroupLayoutResult.value
        ]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesShadowDepthTechnique._getMaskedPipelineLayout] Failed to create WebGPU triangles masked shadow-depth pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._maskedPipelineLayout
    };
  }
}

function isAlphaMaskedShadowBatch(batch: {
  packedBatch: {
    skipDepthPrepass?: boolean;
    uvBuffer?: unknown;
    materialBuffer?: unknown;
    colorBindGroup?: unknown;
  };
}): boolean {
  const packedBatch = batch.packedBatch;
  return packedBatch.skipDepthPrepass === true &&
    !!packedBatch.uvBuffer &&
    !!packedBatch.materialBuffer &&
    !!packedBatch.colorBindGroup;
}
