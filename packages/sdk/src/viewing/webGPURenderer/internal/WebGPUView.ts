import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {View} from "../../viewer";
import type {WebGPUCanvasAlphaMode, WebGPUTextureLike} from "../core";
import type {WebGPUCanvasContextLike} from "./types";
import {WebGPURenderContext} from "./WebGPURenderContext";

/**
 * Per-view WebGPU canvas and attachment owner.
 *
 * @internal
 */
export class WebGPUView {

  public readonly view: View;
  public readonly canvas: HTMLCanvasElement;
  public readonly context: WebGPUCanvasContextLike;
  public readonly alphaMode: WebGPUCanvasAlphaMode;

  private _width = 0;
  private _height = 0;
  private _configured = false;
  private _depthTexture: WebGPUTextureLike | null = null;
  private _depthTextureView: unknown | null = null;

  private constructor(params: {
    view: View;
    canvas: HTMLCanvasElement;
    context: WebGPUCanvasContextLike;
    alphaMode: WebGPUCanvasAlphaMode;
  }) {
    this.view = params.view;
    this.canvas = params.canvas;
    this.context = params.context;
    this.alphaMode = params.alphaMode;
  }

  public static create(view: View, alphaMode?: WebGPUCanvasAlphaMode): SDKResult<WebGPUView> {
    const canvas = WebGPUView._getCanvas(view);
    if (!canvas) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[WebGPUView.create] View '${view.id}' must use an HTMLCanvasElement for WebGPU rendering.`
      };
    }

    const context = WebGPUView._getWebGPUContext(canvas);
    if (!context) {
      return {
        ok: false,
        type: SDKErrorType.NotSupported,
        error: `[WebGPUView.create] View '${view.id}' canvas does not provide a WebGPU context.`
      };
    }

    return {
      ok: true,
      value: new WebGPUView({
        view,
        canvas,
        context,
        alphaMode: alphaMode ?? (view.transparent ? "premultiplied" : "opaque")
      })
    };
  }

  public get depthTextureView(): unknown | null {
    return this._depthTextureView;
  }

  public configure(renderContext: WebGPURenderContext): void {
    const metrics = this._getCanvasMetrics();
    if (
      this._configured &&
      this._width === metrics.width &&
      this._height === metrics.height
    ) {
      return;
    }

    this.canvas.width = metrics.width;
    this.canvas.height = metrics.height;
    this.context.configure({
      device: renderContext.device,
      format: renderContext.contextFormat,
      alphaMode: this.alphaMode
    });
    this._destroyDepthTexture();
    this._depthTexture = renderContext.createDepthTexture(
      `xeokit-webgpu-depth:${this.view.id}`,
      metrics.width,
      metrics.height
    );
    this._depthTextureView = this._depthTexture.createView();
    this._width = metrics.width;
    this._height = metrics.height;
    this._configured = true;
  }

  public destroy(): void {
    try {
      this.context.unconfigure?.();
    } catch {
      // Ignore unconfigure failures during teardown.
    }
    this._destroyDepthTexture();
  }

  private _destroyDepthTexture(): void {
    if (!this._depthTexture) {
      this._depthTextureView = null;
      return;
    }
    try {
      this._depthTexture.destroy?.();
    } catch {
      // Ignore texture destruction failures during teardown.
    }
    this._depthTexture = null;
    this._depthTextureView = null;
  }

  private _getCanvasMetrics(): {width: number; height: number} {
    const rect = typeof this.canvas.getBoundingClientRect === "function"
      ? this.canvas.getBoundingClientRect()
      : null;
    const cssWidth = Math.max(1, Math.round(
      rect?.width ||
      this.canvas.clientWidth ||
      this.view.boundary?.[2] ||
      this.canvas.width ||
      1
    ));
    const cssHeight = Math.max(1, Math.round(
      rect?.height ||
      this.canvas.clientHeight ||
      this.view.boundary?.[3] ||
      this.canvas.height ||
      1
    ));
    const pixelRatio = Math.max(1, (globalThis as {devicePixelRatio?: number}).devicePixelRatio || 1);

    return {
      width: Math.max(1, Math.round(cssWidth * pixelRatio)),
      height: Math.max(1, Math.round(cssHeight * pixelRatio))
    };
  }

  private static _getCanvas(view: View): HTMLCanvasElement | null {
    const element = view.htmlElement;
    const canvasCtor = (globalThis as {HTMLCanvasElement?: typeof HTMLCanvasElement}).HTMLCanvasElement;
    if (canvasCtor && element instanceof canvasCtor) {
      return element;
    }
    if (
      element &&
      typeof (element as HTMLCanvasElement).getContext === "function" &&
      typeof (element as HTMLCanvasElement).width === "number" &&
      typeof (element as HTMLCanvasElement).height === "number"
    ) {
      return element as HTMLCanvasElement;
    }
    return null;
  }

  private static _getWebGPUContext(canvas: HTMLCanvasElement): WebGPUCanvasContextLike | null {
    try {
      const context = canvas.getContext("webgpu") as unknown as WebGPUCanvasContextLike | null;
      if (
        context &&
        typeof context.configure === "function" &&
        typeof context.getCurrentTexture === "function"
      ) {
        return context;
      }
    } catch {
      // Fall through to unsupported result.
    }
    return null;
  }
}
