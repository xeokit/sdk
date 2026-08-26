import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import type {WebGPUBindGroupLayoutLike} from "../../core";
import {GPU_SHADER_STAGE} from "../constants";
import {RenderContext} from "../RenderContext";

/**
 * Owns shared WebGPU bind-group layouts.
 *
 * Draw techniques own shader modules, pipeline layouts, and render pipelines.
 * This manager only owns bind-group layouts that are shared across techniques.
 *
 * @internal
 */
export class BindGroupLayoutManager {

  private readonly _renderContext: RenderContext;
  private _frameBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _instanceBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _trianglePositionDecodeBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _triangleColorBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _splatBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _shadowBindGroupLayout: WebGPUBindGroupLayoutLike | null = null;

  constructor(renderContext: RenderContext) {
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
        }, {
          binding: 1,
          visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT,
          buffer: {
            type: "read-only-storage"
          }
        }, {
          binding: 2,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        }, {
          binding: 3,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          sampler: {
            type: "filtering"
          }
        }, {
          binding: 4,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "cube"
          }
        }, {
          binding: 5,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "cube"
          }
        }, {
          binding: 6,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[BindGroupLayoutManager.getFrameBindGroupLayout] Failed to create WebGPU frame bind group layout: ${e instanceof Error ? e.message : String(e)}`
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
        error: `[BindGroupLayoutManager.getInstanceBindGroupLayout] Failed to create WebGPU instance bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._instanceBindGroupLayout
    };
  }

  public getTrianglePositionDecodeBindGroupLayout(): SDKResult<WebGPUBindGroupLayoutLike> {
    if (this._trianglePositionDecodeBindGroupLayout) {
      return {
        ok: true,
        value: this._trianglePositionDecodeBindGroupLayout
      };
    }

    try {
      this._trianglePositionDecodeBindGroupLayout = this._renderContext.device.createBindGroupLayout({
        label: "xeokit-webgpu-triangle-position-decode-bind-group-layout",
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
        error: `[BindGroupLayoutManager.getTrianglePositionDecodeBindGroupLayout] Failed to create WebGPU triangle position-decode bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._trianglePositionDecodeBindGroupLayout
    };
  }

  public getSplatBindGroupLayout(): SDKResult<WebGPUBindGroupLayoutLike> {
    if (this._splatBindGroupLayout) {
      return {
        ok: true,
        value: this._splatBindGroupLayout
      };
    }

    try {
      this._splatBindGroupLayout = this._renderContext.device.createBindGroupLayout({
        label: "xeokit-webgpu-splat-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT,
          buffer: {
            type: "read-only-storage"
          }
        }, {
          binding: 1,
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
        error: `[BindGroupLayoutManager.getSplatBindGroupLayout] Failed to create WebGPU splat bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._splatBindGroupLayout
    };
  }

  public getTriangleColorBindGroupLayout(): SDKResult<WebGPUBindGroupLayoutLike> {
    if (this._triangleColorBindGroupLayout) {
      return {
        ok: true,
        value: this._triangleColorBindGroupLayout
      };
    }

    try {
      this._triangleColorBindGroupLayout = this._renderContext.device.createBindGroupLayout({
        label: "xeokit-webgpu-triangle-color-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.VERTEX,
          buffer: {
            type: "read-only-storage"
          }
        }, {
          binding: 1,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          sampler: {
            type: "filtering"
          }
        }, {
          binding: 2,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        }, {
          binding: 3,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          sampler: {
            type: "filtering"
          }
        }, {
          binding: 4,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        }, {
          binding: 5,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          sampler: {
            type: "filtering"
          }
        }, {
          binding: 6,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        }, {
          binding: 7,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          sampler: {
            type: "filtering"
          }
        }, {
          binding: 8,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        }, {
          binding: 9,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          sampler: {
            type: "filtering"
          }
        }, {
          binding: 10,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[BindGroupLayoutManager.getTriangleColorBindGroupLayout] Failed to create WebGPU triangle color bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._triangleColorBindGroupLayout
    };
  }

  public getShadowBindGroupLayout(): SDKResult<WebGPUBindGroupLayoutLike> {
    if (this._shadowBindGroupLayout) {
      return {
        ok: true,
        value: this._shadowBindGroupLayout
      };
    }

    try {
      this._shadowBindGroupLayout = this._renderContext.device.createBindGroupLayout({
        label: "xeokit-webgpu-shadow-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        }, {
          binding: 1,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          sampler: {
            type: "comparison"
          }
        }, {
          binding: 2,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "depth",
            viewDimension: "2d-array"
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[BindGroupLayoutManager.getShadowBindGroupLayout] Failed to create WebGPU shadow bind group layout: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._shadowBindGroupLayout
    };
  }

  public destroy(): void {
    this._frameBindGroupLayout = null;
    this._instanceBindGroupLayout = null;
    this._trianglePositionDecodeBindGroupLayout = null;
    this._triangleColorBindGroupLayout = null;
    this._splatBindGroupLayout = null;
    this._shadowBindGroupLayout = null;
  }
}
