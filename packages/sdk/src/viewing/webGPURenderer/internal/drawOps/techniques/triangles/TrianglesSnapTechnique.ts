import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import type {WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT, ID_BUFFER_FORMAT} from "../../../constants";
import type {WebGPURenderPassValue} from "../../../RENDER_PASSES";
import type {PipelineState} from "../../PipelineState";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import {encodePackedTriangleBatches} from "./PackedTriangleBatchEncoder";
import {TRIANGLES_SNAP_SHADER} from "./TrianglesSnapShader";
import {PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS} from "./TrianglePositionPacking";

/**
 * Base implementation for WebGPU triangle snap draw techniques.
 *
 * The synchronous SnapManager path still uses CPU traversal, while the
 * internal async vertex-snap path renders GPU candidates through this
 * WebGL-aligned drawOps slot.
 *
 * @internal
 */
abstract class TrianglesSnapTechnique extends DrawTechnique {

  private readonly _label: string;
  private readonly _topology: "point-list" | "line-list";
  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineState: PipelineState | null = null;

  protected constructor(params: ConstructorParameters<typeof DrawTechnique>[0] & {
    label: string;
    topology: "point-list" | "line-list";
  }) {
    super(params);
    this._label = params.label;
    this._topology = params.topology;
  }

  public getPipelineState(renderPass: WebGPURenderPassValue): SDKResult<PipelineState> {
    void renderPass;
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
      this._pipelineState = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: frameBindGroupLayoutResult.value,
        instanceBindGroupLayout: instanceBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        bindGroupLayoutSignature: ["frame", "instance", "trianglePositionDecode"],
        renderPipeline: this._renderContext.device.createRenderPipeline({
          label: `xeokit-webgpu-${this._label}-pipeline`,
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
              format: ID_BUFFER_FORMAT
            }]
          },
          depthStencil: {
            format: DEPTH_FORMAT,
            depthWriteEnabled: false,
            depthCompare: "less-equal"
          },
          primitive: {
            topology: this._topology,
            cullMode: "none"
          }
        })
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesSnapTechnique.getPipelineState] Failed to create WebGPU ${this._label} pipeline: ${e instanceof Error ? e.message : String(e)}`
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
        error: `[TrianglesSnapTechnique.drawBatches] WebGPU render pass encoder does not expose indexed drawing methods for ${this._label}.`
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
      validateLabel: "TrianglesSnapTechnique.drawBatches",
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
        label: `xeokit-webgpu-${this._label}-shader`,
        code: TRIANGLES_SNAP_SHADER
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesSnapTechnique._getShaderModule] Failed to create WebGPU ${this._label} shader module: ${e instanceof Error ? e.message : String(e)}`
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
        label: `xeokit-webgpu-${this._label}-pipeline-layout`,
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
        error: `[TrianglesSnapTechnique._getPipelineLayout] Failed to create WebGPU ${this._label} pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._pipelineLayout
    };
  }
}

/**
 * WebGPU triangle vertex-snap draw technique.
 *
 * @internal
 */
export class TrianglesSnapVertexTechnique extends TrianglesSnapTechnique {
  constructor(params: ConstructorParameters<typeof DrawTechnique>[0]) {
    super({
      ...params,
      label: "triangles-snap-vertex",
      topology: "point-list"
    });
  }
}

/**
 * WebGPU triangle edge-snap draw technique.
 *
 * @internal
 */
export class TrianglesSnapEdgeTechnique extends TrianglesSnapTechnique {
  constructor(params: ConstructorParameters<typeof DrawTechnique>[0]) {
    super({
      ...params,
      label: "triangles-snap-edge",
      topology: "line-list"
    });
  }
}
