import type {SDKResult} from "../../../../base/core";
import type {WebGPUBufferLike, WebGPUTextureLike} from "../../core";
import {DEPTH_FORMAT, GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE, ID_BUFFER_FORMAT} from "../constants";
import type {RenderContext} from "../RenderContext";

const PICK_READBACK_BYTES_PER_ROW = 256;
const PICK_READBACK_SIZE = PICK_READBACK_BYTES_PER_ROW;

/**
 * Offscreen WebGPU resources for a single-pixel pick render pass.
 *
 * This mirrors WebGLRenderer's WebGLPickBuffer boundary. The synchronous
 * WebGPU pick API still falls back to renderer-side triangle tests until
 * async readback is introduced, but PickManager owns this resource now so the
 * GPU path has a stable home.
 *
 * @internal
 */
export class WebGPUPickBuffer {

  private readonly _renderContext: RenderContext;
  private _colorTexture: WebGPUTextureLike | null = null;
  private _depthTexture: WebGPUTextureLike | null = null;
  private _readbackBuffer: WebGPUBufferLike | null = null;
  private _colorView: unknown = null;
  private _depthView: unknown = null;
  private _width = 0;
  private _height = 0;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
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

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public ensureSize(width = 1, height = 1): SDKResult<void> {
    const nextWidth = Math.max(1, width | 0);
    const nextHeight = Math.max(1, height | 0);
    if (this._colorTexture && this._depthTexture && this._width === nextWidth && this._height === nextHeight) {
      return this._ok();
    }

    this.destroy();
    this._width = nextWidth;
    this._height = nextHeight;
    this._colorTexture = this._renderContext.device.createTexture({
      label: "xeokit-webgpu-pick-color-texture",
      size: {
        width: nextWidth,
        height: nextHeight,
        depthOrArrayLayers: 1
      },
      format: ID_BUFFER_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.COPY_SRC
    });
    this._depthTexture = this._renderContext.device.createTexture({
      label: "xeokit-webgpu-pick-depth-texture",
      size: {
        width: nextWidth,
        height: nextHeight,
        depthOrArrayLayers: 1
      },
      format: DEPTH_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
    });
    this._colorView = this._colorTexture.createView();
    this._depthView = this._depthTexture.createView();
    this._readbackBuffer = this._renderContext.device.createBuffer({
      label: "xeokit-webgpu-pick-readback-buffer",
      size: PICK_READBACK_SIZE,
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
      bytesPerRow: PICK_READBACK_BYTES_PER_ROW,
      rowsPerImage: 1
    };
  }

  public createPickPassDescriptor(): unknown {
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

  public destroy(): void {
    this._colorTexture?.destroy?.();
    this._depthTexture?.destroy?.();
    this._readbackBuffer?.destroy?.();
    this._colorTexture = null;
    this._depthTexture = null;
    this._readbackBuffer = null;
    this._colorView = null;
    this._depthView = null;
    this._width = 0;
    this._height = 0;
  }

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }
}
