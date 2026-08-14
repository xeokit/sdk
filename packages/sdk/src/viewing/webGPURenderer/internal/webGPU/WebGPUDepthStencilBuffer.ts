import type {SDKResult} from "../../../../base/core";
import type {WebGPUTextureLike} from "../../core";
import type {RenderContext} from "../RenderContext";

/**
 * Per-view depth/stencil render target for WebGPU frame rendering.
 *
 * @internal
 */
export class WebGPUDepthStencilBuffer {

  private readonly _renderContext: RenderContext;
  private readonly _label: string;
  private _texture: WebGPUTextureLike | null = null;
  private _view: unknown | null = null;
  private _width = 0;
  private _height = 0;

  constructor(renderContext: RenderContext, label: string) {
    this._renderContext = renderContext;
    this._label = label;
  }

  public get view(): unknown | null {
    return this._view;
  }

  public get texture(): WebGPUTextureLike | null {
    return this._texture;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public ensureSize(width: number, height: number): SDKResult<void> {
    const nextWidth = Math.max(1, width | 0);
    const nextHeight = Math.max(1, height | 0);
    if (this._texture && this._view && this._width === nextWidth && this._height === nextHeight) {
      return this._ok();
    }

    this.destroy();
    this._texture = this._renderContext.createDepthTexture(this._label, nextWidth, nextHeight);
    this._view = this._texture.createView();
    this._width = nextWidth;
    this._height = nextHeight;
    return this._ok();
  }

  public destroy(): void {
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

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }
}
