import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import {createMat4Float64, inverseMat4, type Mat4} from "../../../../../../base/math/matrix";
import type {View} from "../../../../../viewer";
import type {WebGPUBindGroupLike, WebGPUBindGroupLayoutLike, WebGPUBufferLike, WebGPUPipelineLayoutLike, WebGPURenderPassEncoderLike, WebGPUShaderModuleLike} from "../../../../core";
import {DEPTH_FORMAT, GPU_BUFFER_USAGE, GPU_SHADER_STAGE, MAX_SECTION_PLANES} from "../../../constants";
import type {CommandEncoderStatsSink} from "../../../inspectors";
import type {WebGPURenderPassValue} from "../../../RENDER_PASSES";
import {CommandStateTracker} from "../../CommandStateTracker";
import type {PipelineState} from "../../PipelineState";
import {DrawTechnique, type DrawBatchesParams} from "../../DrawTechnique";
import {TRIANGLES_SECTION_PLANE_CAP_SHADER} from "./TrianglesSectionPlaneCapShader";

const CAP_PLANE_UNIFORM_FLOATS = 80;

/**
 * WebGPU draw technique for the fullscreen section-plane cap pass.
 *
 * @internal
 */
export class TrianglesSectionPlaneCapTechnique extends DrawTechnique {

  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _capPlaneBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _pipelineState: PipelineState | null = null;
  private _capPlaneBuffer: WebGPUBufferLike | null = null;
  private _capPlaneBindGroup: WebGPUBindGroupLike | null = null;
  private readonly _uniformData = new Float32Array(CAP_PLANE_UNIFORM_FLOATS);
  private readonly _invViewProjection = createMat4Float64();

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
    const capPlaneBindGroupLayoutResult = this._getCapPlaneBindGroupLayout();
    if (capPlaneBindGroupLayoutResult.ok === false) {
      return capPlaneBindGroupLayoutResult;
    }
    const pipelineLayoutResult = this._getPipelineLayout();
    if (pipelineLayoutResult.ok === false) {
      return pipelineLayoutResult;
    }

    try {
      const renderPipeline = this._renderContext.device.createRenderPipeline({
        label: "xeokit-webgpu-section-plane-cap-plane-pipeline",
        layout: pipelineLayoutResult.value,
        vertex: {
          module: shaderModuleResult.value,
          entryPoint: "vs_main"
        },
        fragment: {
          module: shaderModuleResult.value,
          entryPoint: "fs_main",
          targets: [{
            format: this._renderContext.contextFormat
          }]
        },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: true,
          depthCompare: "less-equal",
          stencilFront: {
            compare: "not-equal",
            failOp: "keep",
            depthFailOp: "keep",
            passOp: "keep"
          },
          stencilBack: {
            compare: "not-equal",
            failOp: "keep",
            depthFailOp: "keep",
            passOp: "keep"
          }
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none"
        }
      });

      this._pipelineState = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: capPlaneBindGroupLayoutResult.value,
        instanceBindGroupLayout: capPlaneBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        renderPipeline,
        bindGroupLayoutSignature: ["sectionPlaneCapPlane"]
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesSectionPlaneCapTechnique.getPipelineState] Failed to create WebGPU section-plane cap pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._pipelineState
    };
  }

  public drawBatches(_params: DrawBatchesParams): SDKResult<void> {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[TrianglesSectionPlaneCapTechnique.drawBatches] Section-plane cap planes are drawn with renderCapPlane()."
    };
  }

  public renderCapPlane(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    view: View;
    viewProjection: Mat4;
    plane: {dir: ArrayLike<number>; dist: number; capColor: ArrayLike<number>};
    otherPlanes: ReadonlyArray<{dir: ArrayLike<number>; dist: number}>;
    viewportWidth: number;
    viewportHeight: number;
    commandStats?: CommandEncoderStatsSink;
    commandStateTracker?: CommandStateTracker;
  }): SDKResult<void> {
    const pipelineStateResult = this.getPipelineState(0);
    if (pipelineStateResult.ok === false) {
      return pipelineStateResult;
    }
    const bindGroupResult = this._writeCapPlaneUniforms(params);
    if (bindGroupResult.ok === false) {
      return bindGroupResult;
    }
    const passEncoder = params.passEncoder;
    if (!passEncoder.setPipeline || !passEncoder.setBindGroup || !passEncoder.draw) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[TrianglesSectionPlaneCapTechnique.renderCapPlane] WebGPU render pass encoder does not expose non-indexed drawing methods."
      };
    }
    const commandStateTracker = params.commandStateTracker ?? new CommandStateTracker({
      passEncoder,
      commandStats: params.commandStats
    });
    commandStateTracker.setPipeline(pipelineStateResult.value);
    commandStateTracker.setBindGroup(0, bindGroupResult.value);
    commandStateTracker.draw(3, 1, 0, 0);
    return {
      ok: true,
      value: undefined
    };
  }

  public override destroy(): void {
    try {
      this._capPlaneBuffer?.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
    }
    this._shaderModule = null;
    this._capPlaneBindGroupLayout = null;
    this._pipelineLayout = null;
    this._pipelineState = null;
    this._capPlaneBuffer = null;
    this._capPlaneBindGroup = null;
  }

  private _writeCapPlaneUniforms(params: {
    view: View;
    viewProjection: Mat4;
    plane: {dir: ArrayLike<number>; dist: number; capColor: ArrayLike<number>};
    otherPlanes: ReadonlyArray<{dir: ArrayLike<number>; dist: number}>;
    viewportWidth: number;
    viewportHeight: number;
  }): SDKResult<WebGPUBindGroupLike> {
    const bindGroupResult = this._getOrCreateCapPlaneBindGroup();
    if (bindGroupResult.ok === false) {
      return bindGroupResult;
    }
    inverseMat4(params.viewProjection, this._invViewProjection);
    this._uniformData.fill(0);
    this._uniformData.set(this._invViewProjection as ArrayLike<number>, 0);
    this._uniformData.set(params.viewProjection as ArrayLike<number>, 16);
    const eye = params.view.camera.eye ?? [0, 0, 0];
    this._uniformData[32] = eye[0];
    this._uniformData[33] = eye[1];
    this._uniformData[34] = eye[2];
    this._uniformData[35] = params.viewportWidth;
    this._uniformData[36] = params.plane.dir[0];
    this._uniformData[37] = params.plane.dir[1];
    this._uniformData[38] = params.plane.dir[2];
    this._uniformData[39] = params.plane.dist;
    this._uniformData[40] = params.plane.capColor[0];
    this._uniformData[41] = params.plane.capColor[1];
    this._uniformData[42] = params.plane.capColor[2];
    this._uniformData[43] = 1;
    const otherCount = Math.min(params.otherPlanes.length, MAX_SECTION_PLANES);
    for (let i = 0; i < otherCount; i++) {
      const other = params.otherPlanes[i];
      const offset = 44 + i * 4;
      this._uniformData[offset + 0] = other.dir[0];
      this._uniformData[offset + 1] = other.dir[1];
      this._uniformData[offset + 2] = other.dir[2];
      this._uniformData[offset + 3] = other.dist;
    }
    this._uniformData[76] = otherCount;
    this._uniformData[77] = params.viewportHeight;
    this._renderContext.device.queue.writeBuffer(this._capPlaneBuffer!, 0, this._uniformData);
    return bindGroupResult;
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
        label: "xeokit-webgpu-section-plane-cap-plane-shader",
        code: TRIANGLES_SECTION_PLANE_CAP_SHADER
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesSectionPlaneCapTechnique._getShaderModule] Failed to create WebGPU section-plane cap shader module: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._shaderModule
    };
  }

  private _getCapPlaneBindGroupLayout(): SDKResult<WebGPUBindGroupLayoutLike> {
    if (this._capPlaneBindGroupLayout) {
      return {
        ok: true,
        value: this._capPlaneBindGroupLayout
      };
    }
    try {
      this._capPlaneBindGroupLayout = this._renderContext.device.createBindGroupLayout({
        label: "xeokit-webgpu-section-plane-cap-plane-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesSectionPlaneCapTechnique._getCapPlaneBindGroupLayout] Failed to create WebGPU section-plane cap bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._capPlaneBindGroupLayout
    };
  }

  private _getPipelineLayout(): SDKResult<WebGPUPipelineLayoutLike> {
    if (this._pipelineLayout) {
      return {
        ok: true,
        value: this._pipelineLayout
      };
    }
    const bindGroupLayoutResult = this._getCapPlaneBindGroupLayout();
    if (bindGroupLayoutResult.ok === false) {
      return bindGroupLayoutResult;
    }
    try {
      this._pipelineLayout = this._renderContext.device.createPipelineLayout({
        label: "xeokit-webgpu-section-plane-cap-plane-pipeline-layout",
        bindGroupLayouts: [bindGroupLayoutResult.value]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesSectionPlaneCapTechnique._getPipelineLayout] Failed to create WebGPU section-plane cap pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._pipelineLayout
    };
  }

  private _getOrCreateCapPlaneBindGroup(): SDKResult<WebGPUBindGroupLike> {
    if (this._capPlaneBindGroup) {
      return {
        ok: true,
        value: this._capPlaneBindGroup
      };
    }
    const bindGroupLayoutResult = this._getCapPlaneBindGroupLayout();
    if (bindGroupLayoutResult.ok === false) {
      return bindGroupLayoutResult;
    }
    try {
      this._capPlaneBuffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-section-plane-cap-plane-uniforms",
        size: this._uniformData.byteLength,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      this._capPlaneBindGroup = this._renderContext.device.createBindGroup({
        label: "xeokit-webgpu-section-plane-cap-plane-bind-group",
        layout: bindGroupLayoutResult.value,
        entries: [{
          binding: 0,
          resource: {
            buffer: this._capPlaneBuffer
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TrianglesSectionPlaneCapTechnique._getOrCreateCapPlaneBindGroup] Failed to create WebGPU section-plane cap bind group: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: this._capPlaneBindGroup
    };
  }
}
