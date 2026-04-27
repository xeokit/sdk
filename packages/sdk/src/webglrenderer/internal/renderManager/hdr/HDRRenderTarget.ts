import type {RenderContext} from "../../RenderContext";
import type {WebGLAbstractTexture} from "../../../../webglutils";

import {WebGLRenderBuffer} from "../../../../webglutils";
import {SDKErrorType, type SDKResult} from "../../../../core";

/**
 * Float16 RGBA render target that stands in for the default framebuffer while
 * the scene is drawn. Preserves linear, above-1.0 intensities all the way
 * through the frame so a later tonemap pass can map them to displayable sRGB.
 *
 * This is the substrate for bloom, DoF, SSR — anything that needs linear HDR
 * colour accumulated before tonemapping.
 *
 * Requires the `EXT_color_buffer_float` WebGL2 extension. {@link init} fails
 * cleanly if the extension is missing so the caller can fall back to LDR.
 *
 * @internal
 */
export class HDRRenderTarget {

  private readonly _renderContext: RenderContext;
  private _buffer: WebGLRenderBuffer | null = null;
  private _ext: object | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Enables the float-colour extension and constructs the backing FBO.
   *
   * Returns an `InitializationFailed` {@link SDKResult} when the extension is
   * unavailable — the caller should treat that as "HDR isn't supported here"
   * and run in LDR mode instead of aborting the whole renderer.
   */
  init(): SDKResult<void> {
    const gl = this._renderContext.gl;

    // Must be enabled before any RGBA16F colour attachment is created.
    this._ext = gl.getExtension("EXT_color_buffer_float");
    if (!this._ext) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[HDRRenderTarget.init] EXT_color_buffer_float not available; HDR rendering requires it."
      };
    }

    this._buffer = new WebGLRenderBuffer(
      this._renderContext.webglCanvasElement,
      gl,
      {
        depthTexture: false,
        // LINEAR so the tonemap pass gets free bilinear downsampling when
        // the scene is rendered at a larger size than the canvas
        // (supersampling via `Tonemap.renderScale`).
        colorFilter: "linear"
      }
    );
    return {ok: true, value: undefined};
  }

  /**
   * Binds this target at a given size, allocating/resizing the colour and
   * depth attachments on demand. Size is explicit so callers can drive
   * supersampling by passing `canvas * renderScale`. RGBA16F colour, plain
   * 24-bit depth renderbuffer.
   */
  bind(width: number, height: number): void {
    if (!this._buffer) {
      return;
    }
    const gl = this._renderContext.gl;
    this._buffer.setSize([width, height]);
    this._buffer.bind(gl.RGBA16F);
  }

  /** Unbinds the target (binds the default framebuffer). */
  unbind(): void {
    this._buffer?.unbind();
  }

  /**
   * Returns a wrapper that binds the HDR colour texture to a given texture
   * unit — used by the tonemap pipeline to sample the HDR frame.
   */
  getTexture(): WebGLAbstractTexture | null {
    return this._buffer ? this._buffer.getTexture() : null;
  }

  destroy(): void {
    this._buffer?.destroy();
    this._buffer = null;
    this._ext = null;
  }
}
