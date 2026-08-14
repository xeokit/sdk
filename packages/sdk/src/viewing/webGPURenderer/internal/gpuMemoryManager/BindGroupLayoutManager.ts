import {SDKErrorType, type SDKResult} from "../../../../base/core";
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

  public destroy(): void {
    this._frameBindGroupLayout = null;
    this._instanceBindGroupLayout = null;
    this._trianglePositionDecodeBindGroupLayout = null;
  }
}
