import type {RenderContext} from "../../RenderContext";
import type {View} from "../../../../viewer";

import {WebGLRenderBuffer} from "../../../../webGLUtils";
import {type SDKResult} from "../../../../core";

import {HDRRenderTarget} from "../hdr/HDRRenderTarget";
import {TonemapPipeline} from "../hdr/TonemapPipeline";
import {FXAAPipeline} from "../fxaa/FXAAPipeline";
import {BloomPipeline} from "../bloom/BloomPipeline";


/**
 * Owns every piece of the HDR substrate and final post-process chain:
 *   - HDR scene render target (RGBA16F).
 *   - LDR intermediate FBO used between tonemap and FXAA.
 *   - Bloom, tonemap, and FXAA pipelines.
 *
 * Separates two RenderManager concerns from each other:
 *   1. Where the scene draws (canvas vs. HDR target).
 *   2. How the scene texture is composited to the canvas at the end.
 *
 * RenderManager's role shrinks to "set up scene state, render the scene,
 * call composite()". Adding a new post-process step (DoF, SSR, color
 * grading, ...) becomes another optional pipeline plugged into this class
 * instead of a diff to RenderManager.
 *
 * Falls back gracefully:
 *   - HDR not supported (extension missing): the whole chain is inert,
 *     scene-binding routes to the default canvas, composite() is a no-op.
 *   - HDR up but FXAA shader fails: renderer still has HDR + tonemap, AA
 *     is silently skipped.
 *   - HDR up but bloom shader fails: same idea, bloom is skipped.
 *
 * Each sub-init returns {@link SDKResult}; failures are localised so the
 * surrounding renderer never aborts a frame because of one shader.
 *
 * @internal
 */
export class PostProcessChain {

  private readonly _renderContext: RenderContext;

  private _hdrTarget: HDRRenderTarget | null = null;
  private _tonemapPipeline: TonemapPipeline | null = null;
  private _fxaaPipeline: FXAAPipeline | null = null;
  private _bloomPipeline: BloomPipeline | null = null;
  private _ldrIntermediate: WebGLRenderBuffer | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Best-effort initialisation of the chain.
   *
   * Always returns `{ok: true}`; individual pipeline failures degrade the
   * chain rather than abort the renderer. Use {@link hasHDR} to query
   * what survived initialisation.
   */
  init(): SDKResult<void> {
    this._initHDR();
    return {ok: true, value: undefined};
  }

  /** True when both halves of the HDR pipeline initialised — implies tonemap is running. */
  hasHDR(): boolean {
    return !!(this._hdrTarget && this._tonemapPipeline);
  }

  /**
   * Binds the scene-phase target — the HDR FBO at the requested size when
   * HDR is active, the default canvas framebuffer otherwise. Callers do
   * their own viewport / clear after this returns.
   */
  bindSceneTarget(width: number, height: number): void {
    if (this.hasHDR()) {
      this._hdrTarget!.bind(width, height);
    } else {
      const gl = this._renderContext.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  }

  /**
   * Runs the post-process chain to the canvas.
   *
   * Order: optional bloom (HDR → adds back into HDR), tonemap (HDR → LDR),
   * optional FXAA (LDR intermediate → canvas). When HDR is off, this is a
   * no-op — the scene has already drawn straight to the canvas.
   */
  composite(view: View): void {
    if (!this.hasHDR()) return;

    const rc = this._renderContext;
    const gl = rc.gl;

    // 1. Bloom (optional). Reads HDR, accumulates a blur pyramid, adds it
    //    back into the HDR target. Tonemap downstream sees the bloomed scene.
    if (this._bloomPipeline && view.effects.bloom.applied && view.effects.bloom.possible) {
      const hdrSrc = this._hdrTarget!.getTexture();
      if (hdrSrc) {
        this._bloomPipeline.render({
          hdrSourceTexture: hdrSrc,
          hdrTarget: this._hdrTarget!,
          view
        });
      }
    }

    const hdrTexture = this._hdrTarget!.getTexture();
    this._hdrTarget!.unbind();
    if (!hdrTexture) return;

    const wantFXAA = !!(
      this._fxaaPipeline &&
      this._ldrIntermediate &&
      view.effects.antiAliasing.mode === "fxaa" &&
      view.effects.antiAliasing.applied &&
      view.effects.antiAliasing.possible
    );
    const vpW = gl.drawingBufferWidth;
    const vpH = gl.drawingBufferHeight;

    if (wantFXAA) {
      // 2a. Tonemap → LDR intermediate, then FXAA → canvas.
      this._ldrIntermediate!.bind();
      gl.viewport(0, 0, vpW, vpH);
      this._tonemapPipeline!.render({hdrTexture, view});

      const ldrTexture = this._ldrIntermediate!.getTexture();
      this._ldrIntermediate!.unbind();
      gl.viewport(0, 0, vpW, vpH);
      if (ldrTexture) {
        this._fxaaPipeline!.render({
          inputTexture: ldrTexture,
          viewportWidth: vpW,
          viewportHeight: vpH
        });
      }
    } else {
      // 2b. Tonemap straight to the canvas.
      gl.viewport(0, 0, vpW, vpH);
      this._tonemapPipeline!.render({hdrTexture, view});
    }
  }

  destroy(): void {
    this._hdrTarget?.destroy();
    this._hdrTarget = null;
    this._tonemapPipeline?.destroy();
    this._tonemapPipeline = null;
    this._fxaaPipeline?.destroy();
    this._fxaaPipeline = null;
    this._bloomPipeline?.destroy();
    this._bloomPipeline = null;
    this._ldrIntermediate?.destroy();
    this._ldrIntermediate = null;
  }

  // ------------------------------------------------------------------
  // Private init plumbing — three layers, each gracefully degrades.
  // ------------------------------------------------------------------

  private _initHDR(): void {
    this._hdrTarget = new HDRRenderTarget(this._renderContext);
    const hdrResult = this._hdrTarget.init();
    if (hdrResult.ok === false) {
      this._hdrTarget.destroy();
      this._hdrTarget = null;
      return;
    }

    this._tonemapPipeline = new TonemapPipeline(this._renderContext);
    const tmResult = this._tonemapPipeline.init();
    if (tmResult.ok === false) {
      this._tonemapPipeline.destroy();
      this._tonemapPipeline = null;
      this._hdrTarget.destroy();
      this._hdrTarget = null;
      return;
    }

    this._initFXAA();
    this._initBloom();
  }

  private _initFXAA(): void {
    this._fxaaPipeline = new FXAAPipeline(this._renderContext);
    const result = this._fxaaPipeline.init();
    if (result.ok === false) {
      this._fxaaPipeline.destroy();
      this._fxaaPipeline = null;
      return;
    }

    this._ldrIntermediate = new WebGLRenderBuffer(
      this._renderContext.webglCanvasElement,
      this._renderContext.gl,
      {
        depthTexture: false,
        // FXAA's directional resolve taps sample at sub-texel offsets along
        // the detected edge — LINEAR filtering is required, NEAREST collapses
        // the algorithm into a plain box blur.
        colorFilter: "linear"
      }
    );
  }

  private _initBloom(): void {
    this._bloomPipeline = new BloomPipeline(this._renderContext);
    const result = this._bloomPipeline.init();
    if (result.ok === false) {
      this._bloomPipeline.destroy();
      this._bloomPipeline = null;
    }
  }
}
