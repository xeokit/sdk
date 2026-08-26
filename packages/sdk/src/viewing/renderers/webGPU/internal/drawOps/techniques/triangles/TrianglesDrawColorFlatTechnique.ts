import {SDKErrorType, type SDKResult} from "../../../../../../../base/core";
import type {WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT} from "../../../constants";
import {RENDER_PASSES} from "../../../RENDER_PASSES";
import type {WebGPURenderPassValue} from "../../../RENDER_PASSES";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import type {PipelineState} from "../../PipelineState";
import {encodePackedTriangleBatches} from "./PackedTriangleBatchEncoder";
import {createTrianglesDrawColorFlatShader} from "./TrianglesDrawColorFlatShader";
import {PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS} from "./TrianglePositionPacking";

type TriangleFlatDepthCompare = "always" | "less-equal";

/**
 * WebGPU flat triangle technique.
 *
 * @internal
 */
export class TrianglesDrawColorFlatTechnique extends DrawTechnique {

  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineStates: {[key: string]: PipelineState | undefined} = {};
  private readonly _depthCompare: TriangleFlatDepthCompare;
  private readonly _labelSuffix: string;

  constructor(params: ConstructorParameters<typeof DrawTechnique>[0] & {
    depthCompare?: TriangleFlatDepthCompare;
    labelPrefix?: string;
  }) {
    super(params);
    this._depthCompare = params.depthCompare ?? "always";
    this._labelSuffix = params.labelPrefix ? `-${params.labelPrefix}` : "";
  }

  public getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<PipelineState> {
    const colorTargetFormat = this._renderContext.colorTargetFormat;
    const pipelineKey = `${this._depthCompare}:${renderPass}:${colorTargetFormat}`;
    const existing = this._pipelineStates[pipelineKey];
    if (existing) {
      return {
        ok: true,
        value: existing
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
      if (!this._shaderModule) {
        this._shaderModule = this._renderContext.device.createShaderModule({
          label: "xeokit-webgpu-triangles-draw-flat-color-shader",
          code: createTrianglesDrawColorFlatShader()
        });
      }
      if (!this._pipelineLayout) {
        this._pipelineLayout = this._renderContext.device.createPipelineLayout({
          label: "xeokit-webgpu-triangles-draw-flat-color-pipeline-layout",
          bindGroupLayouts: [
            frameBindGroupLayoutResult.value,
            instanceBindGroupLayoutResult.value,
            positionDecodeBindGroupLayoutResult.value
          ]
        });
      }
      const transparent = renderPass === RENDER_PASSES.TRANSPARENT;
      const renderPipeline = this._renderContext.device.createRenderPipeline({
        label: transparent
          ? `xeokit-webgpu-triangles-draw-flat-color${this._labelSuffix}-transparent-pipeline`
          : `xeokit-webgpu-triangles-draw-flat-color${this._labelSuffix}-opaque-pipeline`,
        layout: this._pipelineLayout,
        vertex: {
          module: this._shaderModule,
          entryPoint: "vs_main",
          buffers: PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS
        },
        fragment: {
          module: this._shaderModule,
          entryPoint: "fs_main",
          targets: [{
            format: colorTargetFormat,
            blend: transparent ? {
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
          depthWriteEnabled: !transparent,
          depthCompare: this._depthCompare
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none"
        }
      });

      this._pipelineStates[pipelineKey] = {
        shaderModule: this._shaderModule,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: instanceBindGroupLayoutResult.value,
        pipelineLayout: this._pipelineLayout,
        renderPipeline,
        bindGroupLayoutSignature: ["frame", "instance", "trianglePositionDecode"]
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesDrawColorFlatTechnique.getPipelineState] Failed to create WebGPU pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._pipelineStates[pipelineKey]!
    };
  }

  public drawBatches(params: DrawBatchesParams): SDKResult<void> {
    const {passEncoder, pipelineState} = params;
    params.commandStateTracker.setPipeline(pipelineState);
    params.commandStateTracker.setBindGroup(0, params.frameBindGroup);
    params.commandStateTracker.setBindGroup(1, params.instanceBindGroup);

    return encodePackedTriangleBatches({
      device: this._renderContext.device,
      passEncoder,
      batches: params.batches,
      renderPass: params.renderPass,
      validateLabel: "TrianglesDrawColorFlatTechnique.drawBatches",
      commandStats: params.commandStats,
      commandStateTracker: params.commandStateTracker
    });
  }
}
