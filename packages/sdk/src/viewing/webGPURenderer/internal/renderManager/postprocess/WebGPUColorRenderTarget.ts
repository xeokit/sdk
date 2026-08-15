import type {WebGPUTextureLike} from "../../../core";
import {GPU_TEXTURE_USAGE} from "../../constants";
import type {RenderContext} from "../../RenderContext";

/**
 * Resizable color texture used as the scene target when WebGPU post-processing
 * is active.
 *
 * @internal
 */
export class WebGPUColorRenderTarget {

  private readonly _renderContext: RenderContext;
  private readonly _label: string;
  private readonly _format: string;
  private _width = 0;
  private _height = 0;
  private _texture: WebGPUTextureLike | null = null;
  private _view: unknown | null = null;

  constructor(renderContext: RenderContext, label: string, format?: string) {
    this._renderContext = renderContext;
    this._label = label;
    this._format = format ?? renderContext.contextFormat;
  }

  get texture(): WebGPUTextureLike | null {
    return this._texture;
  }

  get view(): unknown | null {
    return this._view;
  }

  get format(): string {
    return this._format;
  }

  ensureSize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (this._texture && this._view && this._width === nextWidth && this._height === nextHeight) {
      return;
    }
    this.destroy();
    this._texture = this._renderContext.device.createTexture({
      label: this._label,
      size: {
        width: nextWidth,
        height: nextHeight,
        depthOrArrayLayers: 1
      },
      format: this._format,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_SRC
    });
    this._view = this._texture.createView();
    this._width = nextWidth;
    this._height = nextHeight;
  }

  destroy(): void {
    try {
      this._texture?.destroy?.();
    } catch {
      // Ignore texture destruction failures during teardown.
    }
    this._texture = null;
    this._view = null;
    this._width = 0;
    this._height = 0;
  }
}
