import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import type {WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT} from "../../../constants";
import {RENDER_PASSES, type WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {PipelineState} from "../../PipelineState";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import {encodePackedTriangleBatches} from "./PackedTriangleBatchEncoder";
import {createTrianglesDrawColorNoNormalsShader} from "./TrianglesDrawColorNoNormalsShader";
import {PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS} from "./TrianglePositionPacking";

const PACKED_TRIANGLE_NO_NORMALS_VERTEX_BUFFER_LAYOUTS = [
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
    arrayStride: 32,
    attributes: [{
      shaderLocation: 3,
      offset: 0,
      format: "float32x4"
    }, {
      shaderLocation: 4,
      offset: 16,
      format: "float32x4"
    }]
  },
  {
    arrayStride: 16,
    attributes: [{
      shaderLocation: 5,
      offset: 0,
      format: "float32x4"
    }]
  }
];

/**
 * WebGPU triangle color technique for geometry without authored normals.
 *
 * @internal
 */
export class TrianglesDrawColorNoNormalsTechnique extends DrawTechnique {

  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineStates: {[key: string]: PipelineState | undefined} = {};

  public getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<PipelineState> {
    const colorTargetFormat = this._renderContext.colorTargetFormat;
    const pipelineKey = `${renderPass}:${colorTargetFormat}`;
    const existing = this._pipelineStates[pipelineKey];
    if (existing) {
      return {
        ok: true,
        value: existing
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
        label: renderPass === RENDER_PASSES.TRANSPARENT
          ? "xeokit-webgpu-triangles-draw-color-no-normals-transparent-pipeline"
          : "xeokit-webgpu-triangles-draw-color-no-normals-opaque-pipeline",
        layout: pipelineLayoutResult.value,
        vertex: {
          module: shaderModuleResult.value,
          entryPoint: "vs_main",
          buffers: PACKED_TRIANGLE_NO_NORMALS_VERTEX_BUFFER_LAYOUTS
        },
        fragment: {
          module: shaderModuleResult.value,
          entryPoint: "fs_main",
          targets: [{
            format: colorTargetFormat,
            blend: renderPass === RENDER_PASSES.TRANSPARENT ? {
              color: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              }
            } : undefined
          }]
        },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: renderPass === RENDER_PASSES.OPAQUE,
          depthCompare: "less-equal"
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none"
        }
      });

      this._pipelineStates[pipelineKey] = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: instanceBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        renderPipeline,
        bindGroupLayoutSignature: ["frame", "instance", "triangleColor", "shadow"]
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesDrawColorNoNormalsTechnique.getPipelineState] Failed to create WebGPU triangles no-normal draw-color pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._pipelineStates[pipelineKey]!
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
        error: "[TrianglesDrawColorNoNormalsTechnique.drawBatches] WebGPU render pass encoder does not expose indexed drawing methods."
      };
    }

    params.commandStateTracker.setPipeline(pipelineState);
    params.commandStateTracker.setBindGroup(0, frameBindGroup);
    params.commandStateTracker.setBindGroup(1, instanceBindGroup);
    if (!this._renderContext.shadowBindGroup) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[TrianglesDrawColorNoNormalsTechnique.drawBatches] WebGPU shadow bind group was not initialized."
      };
    }
    params.commandStateTracker.setBindGroup(3, this._renderContext.shadowBindGroup);

    return encodePackedTriangleBatches({
      device: this._renderContext.device,
      passEncoder,
      batches,
      renderPass: params.renderPass,
      validateLabel: "TrianglesDrawColorNoNormalsTechnique.drawBatches",
      bindPositionDecode: false,
      bindBeforeDraw: (packedBatch) => {
        if (packedBatch.uvBuffer) {
          const uvBufferOffset = packedBatch.indicesPageLocal ? 0 : (packedBatch.uvBufferOffset ?? 0);
          params.commandStateTracker.setVertexBuffer(2, packedBatch.uvBuffer, uvBufferOffset);
        } else {
          const vertexBufferOffset = packedBatch.indicesPageLocal ? 0 : (packedBatch.vertexBufferOffset ?? 0);
          params.commandStateTracker.setVertexBuffer(2, packedBatch.vertexBuffer, vertexBufferOffset);
        }
        if (packedBatch.colorBindGroup) {
          params.commandStateTracker.setBindGroup(2, packedBatch.colorBindGroup);
        }
        if (packedBatch.materialBuffer) {
          const materialBufferOffset = packedBatch.indicesPageLocal ? 0 : (packedBatch.materialBufferOffset ?? 0);
          params.commandStateTracker.setVertexBuffer(3, packedBatch.materialBuffer, materialBufferOffset);
        }
        if (packedBatch.normalBuffer) {
          const normalBufferOffset = packedBatch.indicesPageLocal ? 0 : (packedBatch.normalBufferOffset ?? 0);
          params.commandStateTracker.setVertexBuffer(4, packedBatch.normalBuffer, normalBufferOffset);
        }
      },
      commandStats: params.commandStats,
      commandStateTracker: params.commandStateTracker
    });
  }

  public destroy(): void {
    this._shaderModule = null;
    this._pipelineLayout = null;
    this._pipelineStates = {};
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
        label: this._renderContext.renderConfigs.logDepth
          ? "xeokit-webgpu-triangles-draw-color-no-normals-log-depth-shader"
          : "xeokit-webgpu-triangles-draw-color-no-normals-shader",
        code: createTrianglesDrawColorNoNormalsShader(this._renderContext.renderConfigs.logDepth)
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesDrawColorNoNormalsTechnique._getShaderModule] Failed to create WebGPU triangles no-normal draw-color shader module: ${e instanceof Error ? e.message : String(e)}`
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
    const triangleColorBindGroupLayoutResult = this._bindGroupLayoutManager.getTriangleColorBindGroupLayout();
    if (triangleColorBindGroupLayoutResult.ok === false) {
      return triangleColorBindGroupLayoutResult;
    }
    const shadowBindGroupLayoutResult = this._bindGroupLayoutManager.getShadowBindGroupLayout();
    if (shadowBindGroupLayoutResult.ok === false) {
      return shadowBindGroupLayoutResult;
    }

    try {
      this._pipelineLayout = this._renderContext.device.createPipelineLayout({
        label: "xeokit-webgpu-triangles-draw-color-no-normals-pipeline-layout",
        bindGroupLayouts: [
          frameBindGroupLayoutResult.value,
          instanceBindGroupLayoutResult.value,
          triangleColorBindGroupLayoutResult.value,
          shadowBindGroupLayoutResult.value
        ]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesDrawColorNoNormalsTechnique._getPipelineLayout] Failed to create WebGPU triangles no-normal draw-color pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._pipelineLayout
    };
  }
}
