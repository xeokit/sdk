import type {SDKResult} from "../../../../base/core";
import type {WebGPUBufferLike, WebGPUTextureLike} from "../../core";
import {DEPTH_FORMAT, GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE, ID_BUFFER_FORMAT} from "../constants";
import type {RenderContext} from "../RenderContext";

const WEBGPU_COPY_BYTES_PER_ROW_ALIGNMENT = 256;

function alignBytesPerRow(bytesPerRow: number): number {
  return Math.ceil(bytesPerRow / WEBGPU_COPY_BYTES_PER_ROW_ALIGNMENT) * WEBGPU_COPY_BYTES_PER_ROW_ALIGNMENT;
}

/**
 * Offscreen WebGPU resources for snap-to-vertex / snap-to-edge passes.
 *
 * Sized to `(2 * snapRadius + 1)^2`, matching WebGLRenderer's snap buffer
 * model. The current synchronous WebGPU snap implementation still uses CPU
 * traversal, but SnapManager now owns a WebGPU snap target and can switch to
 * actual snap draw/readback passes without changing its public boundary.
 *
 * @internal
 */
export class WebGPUSnapBuffer {

  private readonly _renderContext: RenderContext;
  private readonly _snapRadius: number;
  private _colorTexture: WebGPUTextureLike | null = null;
  private _depthTexture: WebGPUTextureLike | null = null;
  private _readbackBuffer: WebGPUBufferLike | null = null;
  private _colorView: unknown = null;
  private _depthView: unknown = null;
  private _readbackBytesPerRow = 0;

  constructor(renderContext: RenderContext, snapRadius: number) {
    this._renderContext = renderContext;
    this._snapRadius = snapRadius;
  }

  public get snapRadius(): number {
    return this._snapRadius;
  }

  public get dimension(): number {
    return this._snapRadius * 2 + 1;
  }

  public get colorView(): unknown {
    return this._colorView;
  }

  public get colorTexture(): WebGPUTextureLike | null {
    return this._colorTexture;
  }

  public get depthView(): unknown {
    return this._depthView;
  }

  public get readbackBuffer(): WebGPUBufferLike | null {
    return this._readbackBuffer;
  }

  public init(): SDKResult<void> {
    if (this._colorTexture && this._depthTexture) {
      return this._ok();
    }
    const dimension = this.dimension;
    this._colorTexture = this._renderContext.device.createTexture({
      label: `xeokit-webgpu-snap-color-texture:${this._snapRadius}`,
      size: {
        width: dimension,
        height: dimension,
        depthOrArrayLayers: 1
      },
      format: ID_BUFFER_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.COPY_SRC
    });
    this._depthTexture = this._renderContext.device.createTexture({
      label: `xeokit-webgpu-snap-depth-texture:${this._snapRadius}`,
      size: {
        width: dimension,
        height: dimension,
        depthOrArrayLayers: 1
      },
      format: DEPTH_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
    });
    this._colorView = this._colorTexture.createView();
    this._depthView = this._depthTexture.createView();
    this._readbackBytesPerRow = alignBytesPerRow(dimension * 4);
    this._readbackBuffer = this._renderContext.device.createBuffer({
      label: `xeokit-webgpu-snap-readback-buffer:${this._snapRadius}`,
      size: this._readbackBytesPerRow * dimension,
      usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
    });
    return this._ok();
  }

  public getCopyDestination(): {
    buffer: WebGPUBufferLike;
    bytesPerRow: number;
    rowsPerImage: number;
  } | null {
    if (!this._readbackBuffer) {
      return null;
    }
    return {
      buffer: this._readbackBuffer,
      bytesPerRow: this._readbackBytesPerRow,
      rowsPerImage: this.dimension
    };
  }

  public createDepthPrepassDescriptor(): unknown {
    return {
      colorAttachments: [{
        view: this._colorView,
        clearValue: {
          r: 0,
          g: 0,
          b: 0,
          a: 0
        },
        loadOp: "clear",
        storeOp: "store"
      }],
      depthStencilAttachment: {
        view: this._depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        stencilClearValue: 0,
        stencilLoadOp: "clear",
        stencilStoreOp: "store"
      }
    };
  }

  public createSnapPassDescriptor(): unknown {
    return {
      colorAttachments: [{
        view: this._colorView,
        clearValue: {
          r: 0,
          g: 0,
          b: 0,
          a: 0
        },
        loadOp: "clear",
        storeOp: "store"
      }],
      depthStencilAttachment: {
        view: this._depthView,
        depthLoadOp: "load",
        depthStoreOp: "store",
        stencilLoadOp: "load",
        stencilStoreOp: "store"
      }
    };
  }

  public destroy(): void {
    this._colorTexture?.destroy?.();
    this._depthTexture?.destroy?.();
    this._readbackBuffer?.destroy?.();
    this._colorTexture = null;
    this._depthTexture = null;
    this._readbackBuffer = null;
    this._colorView = null;
    this._depthView = null;
    this._readbackBytesPerRow = 0;
  }

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }
}

/**
 * Radius-keyed cache for WebGPU snap buffers.
 *
 * @internal
 */
export class WebGPUSnapBufferCache {

  private readonly _renderContext: RenderContext;
  private readonly _buffers = new Map<number, WebGPUSnapBuffer>();

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  public get(snapRadius: number): SDKResult<WebGPUSnapBuffer> {
    const radius = Math.max(1, snapRadius | 0);
    let buffer = this._buffers.get(radius);
    if (!buffer) {
      buffer = new WebGPUSnapBuffer(this._renderContext, radius);
      this._buffers.set(radius, buffer);
    }
    const initResult = buffer.init();
    if (initResult.ok === false) {
      return initResult;
    }
    return {
      ok: true,
      value: buffer
    };
  }

  public destroy(): void {
    for (const buffer of this._buffers.values()) {
      buffer.destroy();
    }
    this._buffers.clear();
  }
}
