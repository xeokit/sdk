import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {WebGPUBindGroupLayoutLike, WebGPUPipelineLayoutLike, WebGPUShaderModuleLike} from "../core";
import {DEPTH_FORMAT, GPU_SHADER_STAGE, TRIANGLE_SHADER} from "./constants";
import {RENDER_PASSES, type WebGPURenderPassValue} from "./RENDER_PASSES";
import type {WebGPUPipelineState} from "./types";
import {WebGPURenderContext} from "./WebGPURenderContext";

/**
 * Owns WebGPU shader modules, layouts, and render pipelines.
 *
 * @internal
 */
export class WebGPUPipelineManager {

  private readonly _renderContext: WebGPURenderContext;
  private _meshShaderModule: WebGPUShaderModuleLike | null = null;
  private _frameBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _instanceBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _meshPipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _meshPipelineStates: {[renderPass: number]: WebGPUPipelineState | undefined} = {};

  constructor(renderContext: WebGPURenderContext) {
    this._renderContext = renderContext;
  }

  public getFrameBindGroupLayout(): SDKResult<WebGPUBindGroupLayoutLike> {
    if (this._frameBindGroupLayout) {
      return {
        ok: true,
        value: this._frameBindGroupLayout
      };
    }

    try {
      this._frameBindGroupLayout = this._renderContext.device.createBindGroupLayout({
        label: "xeokit-webgpu-frame-bind-group-layout",
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
        error: `[WebGPUPipelineManager.getFrameBindGroupLayout] Failed to create WebGPU frame bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._frameBindGroupLayout
    };
  }

  public getInstanceBindGroupLayout(): SDKResult<WebGPUBindGroupLayoutLike> {
    if (this._instanceBindGroupLayout) {
      return {
        ok: true,
        value: this._instanceBindGroupLayout
      };
    }

    try {
      this._instanceBindGroupLayout = this._renderContext.device.createBindGroupLayout({
        label: "xeokit-webgpu-instance-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.VERTEX,
          buffer: {
            type: "read-only-storage"
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUPipelineManager.getInstanceBindGroupLayout] Failed to create WebGPU instance bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._instanceBindGroupLayout
    };
  }

  public getMeshPipelineState(renderPass: WebGPURenderPassValue = RENDER_PASSES.OPAQUE): SDKResult<WebGPUPipelineState> {
    const existing = this._meshPipelineStates[renderPass];
    if (existing) {
      return {
        ok: true,
        value: existing
      };
    }

    const device = this._renderContext.device;
    const shaderModuleResult = this._getMeshShaderModule();
    if (shaderModuleResult.ok === false) {
      return shaderModuleResult;
    }
    const bindGroupLayoutResult = this.getFrameBindGroupLayout();
    if (bindGroupLayoutResult.ok === false) {
      return bindGroupLayoutResult;
    }
    const instanceBindGroupLayoutResult = this.getInstanceBindGroupLayout();
    if (instanceBindGroupLayoutResult.ok === false) {
      return instanceBindGroupLayoutResult;
    }
    const pipelineLayoutResult = this._getMeshPipelineLayout();
    if (pipelineLayoutResult.ok === false) {
      return pipelineLayoutResult;
    }

    try {
      const renderPipeline = device.createRenderPipeline({
        label: renderPass === RENDER_PASSES.TRANSPARENT
          ? "xeokit-webgpu-basic-triangle-transparent-pipeline"
          : "xeokit-webgpu-basic-triangle-opaque-pipeline",
        layout: pipelineLayoutResult.value,
        vertex: {
          module: shaderModuleResult.value,
          entryPoint: "vs_main",
          buffers: [
            {
              arrayStride: 12,
              attributes: [{
                shaderLocation: 0,
                offset: 0,
                format: "float32x3"
              }]
            },
            {
              arrayStride: 12,
              attributes: [{
                shaderLocation: 1,
                offset: 0,
                format: "float32x3"
              }]
            },
            {
              arrayStride: 4,
              attributes: [{
                shaderLocation: 2,
                offset: 0,
                format: "uint32"
              }]
            }
          ]
        },
        fragment: {
          module: shaderModuleResult.value,
          entryPoint: "fs_main",
          targets: [{
            format: this._renderContext.contextFormat,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              }
            }
          }]
        },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: renderPass === RENDER_PASSES.OPAQUE,
          depthCompare: "less"
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none"
        }
      });

      this._meshPipelineStates[renderPass] = {
        shaderModule: shaderModuleResult.value,
        frameBindGroupLayout: bindGroupLayoutResult.value,
        instanceBindGroupLayout: instanceBindGroupLayoutResult.value,
        pipelineLayout: pipelineLayoutResult.value,
        renderPipeline
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUPipelineManager.getMeshPipelineState] Failed to create WebGPU render pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._meshPipelineStates[renderPass]!
    };
  }

  private _getMeshShaderModule(): SDKResult<WebGPUShaderModuleLike> {
    if (this._meshShaderModule) {
      return {
        ok: true,
        value: this._meshShaderModule
      };
    }

    try {
      this._meshShaderModule = this._renderContext.device.createShaderModule({
        label: "xeokit-webgpu-basic-triangle-shader",
        code: TRIANGLE_SHADER
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUPipelineManager._getMeshShaderModule] Failed to create WebGPU mesh shader module: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._meshShaderModule
    };
  }

  private _getMeshPipelineLayout(): SDKResult<WebGPUPipelineLayoutLike> {
    if (this._meshPipelineLayout) {
      return {
        ok: true,
        value: this._meshPipelineLayout
      };
    }

    const bindGroupLayoutResult = this.getFrameBindGroupLayout();
    if (bindGroupLayoutResult.ok === false) {
      return bindGroupLayoutResult;
    }
    const instanceBindGroupLayoutResult = this.getInstanceBindGroupLayout();
    if (instanceBindGroupLayoutResult.ok === false) {
      return instanceBindGroupLayoutResult;
    }

    try {
      this._meshPipelineLayout = this._renderContext.device.createPipelineLayout({
        label: "xeokit-webgpu-basic-triangle-pipeline-layout",
        bindGroupLayouts: [bindGroupLayoutResult.value, instanceBindGroupLayoutResult.value]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUPipelineManager._getMeshPipelineLayout] Failed to create WebGPU mesh pipeline layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._meshPipelineLayout
    };
  }

  public destroy(): void {
    this._meshShaderModule = null;
    this._frameBindGroupLayout = null;
    this._instanceBindGroupLayout = null;
    this._meshPipelineLayout = null;
    this._meshPipelineStates = {};
  }
}
