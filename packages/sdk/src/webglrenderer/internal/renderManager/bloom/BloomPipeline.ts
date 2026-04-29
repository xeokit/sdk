import type {RenderContext} from "../../RenderContext";
import type {WebGLAbstractTexture} from "../../../../webglutils";
import type {View} from "../../../../viewer";
import type {HDRRenderTarget} from "../hdr/HDRRenderTarget";

import {WebGLProgram, WebGLRenderBuffer} from "../../../../webglutils";
import {SDKErrorType, type SDKResult} from "../../../../core";

/**
 * HDR bloom post-process (Kawase dual filter, Bjørge 2015).
 *
 * 1. **Prefilter**: read the HDR scene, apply a soft-knee luminance threshold,
 *    write to mip[0] at half scene resolution.
 * 2. **Downsample chain**: bilinear 5-tap Kawase shrink to progressively
 *    smaller FBOs (mip[0] → mip[1] → ... → mip[N-1]).
 * 3. **Upsample chain**: 8-tap tent with additive blend back up the chain
 *    (mip[N-1] → ... → mip[0]).
 * 4. **Composite**: add mip[0] into the HDR target at `intensity` scale.
 *
 * The whole chain lives in RGBA16F textures so the HDR range is preserved
 * end-to-end. Tonemap runs after this writes back into the HDR target, so
 * bloom passes through the same exposure/curve/sRGB encoding as everything
 * else.
 *
 * @internal
 */
export class BloomPipeline {

  private readonly _renderContext: RenderContext;

  private _prefilterProgram: WebGLProgram | null = null;
  private _downProgram: WebGLProgram | null = null;
  private _upProgram: WebGLProgram | null = null;

  private _uPreInput: WebGLUniformLocation | null = null;
  private _uPreThreshold: WebGLUniformLocation | null = null;
  private _uPreKnee: WebGLUniformLocation | null = null;

  private _uDownInput: WebGLUniformLocation | null = null;
  private _uDownHalfpixel: WebGLUniformLocation | null = null;

  private _uUpInput: WebGLUniformLocation | null = null;
  private _uUpHalfpixel: WebGLUniformLocation | null = null;
  private _uUpIntensity: WebGLUniformLocation | null = null;

  /**
   * Five-stop mip pyramid. mip[0] = half scene size; each subsequent level
   * halves again. More levels → wider, softer bloom; five is a good
   * perceptual sweet spot without ever going below ~a few texels.
   */
  private readonly _numMips = 5;
  private readonly _mipChain: WebGLRenderBuffer[] = [];
  private readonly _mipSizes: Array<[number, number]> = [];

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Compiles the three post-process shaders. Returns `InitializationFailed`
   * if any fails to link; caller treats that as "skip bloom this frame" and
   * nothing else breaks.
   */
  init(): SDKResult<void> {
    try {
      const pre = new WebGLProgram(this._renderContext, {vertex: VS_FULLSCREEN, fragment: FS_PREFILTER});
      const preResult = pre.init();
      if (preResult.ok === false) {
        pre.destroy();
        return {ok: false, type: SDKErrorType.InitializationFailed, error: `[BloomPipeline] prefilter: ${preResult.error}`};
      }
      this._prefilterProgram = pre;
      this._uPreInput = pre.getSampler("uInput");
      this._uPreThreshold = pre.getLocation("uThreshold");
      this._uPreKnee = pre.getLocation("uKnee");

      const down = new WebGLProgram(this._renderContext, {vertex: VS_FULLSCREEN, fragment: FS_DOWN});
      const downResult = down.init();
      if (downResult.ok === false) {
        down.destroy();
        this.destroy();
        return {ok: false, type: SDKErrorType.InitializationFailed, error: `[BloomPipeline] down: ${downResult.error}`};
      }
      this._downProgram = down;
      this._uDownInput = down.getSampler("uInput");
      this._uDownHalfpixel = down.getLocation("uHalfpixel");

      const up = new WebGLProgram(this._renderContext, {vertex: VS_FULLSCREEN, fragment: FS_UP});
      const upResult = up.init();
      if (upResult.ok === false) {
        up.destroy();
        this.destroy();
        return {ok: false, type: SDKErrorType.InitializationFailed, error: `[BloomPipeline] up: ${upResult.error}`};
      }
      this._upProgram = up;
      this._uUpInput = up.getSampler("uInput");
      this._uUpHalfpixel = up.getLocation("uHalfpixel");
      this._uUpIntensity = up.getLocation("uIntensity");

      return {ok: true, value: undefined};
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[BloomPipeline.init] ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  /**
   * Runs the full bloom pipeline: prefilter → downsample chain →
   * upsample-and-add chain → final additive composite back into the HDR
   * target.
   *
   * No-op if disabled, or if the scene size collapsed to zero.
   */
  render(params: { hdrSourceTexture: WebGLAbstractTexture; hdrTarget: HDRRenderTarget; view: View }): void {
    if (!this._prefilterProgram || !this._downProgram || !this._upProgram) return;

    const {hdrSourceTexture, hdrTarget, view} = params;
    const bloom = view.bloom;

    const rc = this._renderContext;
    const gl = rc.gl;
    const sceneW = rc.sceneRenderWidth || gl.drawingBufferWidth;
    const sceneH = rc.sceneRenderHeight || gl.drawingBufferHeight;
    if (sceneW <= 0 || sceneH <= 0) return;

    this._ensureMipChain(sceneW, sceneH);
    if (this._mipChain.length === 0) return;

    // Fullscreen triangle state — same baseline every pass.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    // ---- 1. Prefilter HDR → mip[0] ---------------------------------------
    gl.disable(gl.BLEND);
    this._mipChain[0].bind(gl.RGBA16F);
    const [m0W, m0H] = this._mipSizes[0];
    gl.viewport(0, 0, m0W, m0H);
    this._prefilterProgram.bind();
    hdrSourceTexture.bind(0);
    if (this._uPreInput) gl.uniform1i(this._uPreInput, 0);
    if (this._uPreThreshold) gl.uniform1f(this._uPreThreshold, bloom.threshold);
    if (this._uPreKnee) gl.uniform1f(this._uPreKnee, bloom.knee);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this._mipChain[0].unbind();

    // ---- 2. Downsample chain: mip[i] -> mip[i+1] -------------------------
    this._downProgram.bind();
    if (this._uDownInput) gl.uniform1i(this._uDownInput, 0);
    for (let i = 0; i < this._numMips - 1; i++) {
      const [srcW, srcH] = this._mipSizes[i];
      const [dstW, dstH] = this._mipSizes[i + 1];
      this._mipChain[i + 1].bind(gl.RGBA16F);
      gl.viewport(0, 0, dstW, dstH);
      this._mipChain[i].getTexture().bind(0);
      // Kawase's "halfpixel" is 1 / source-size: offsets are relative to
      // the SOURCE texture, not the destination we're writing to.
      if (this._uDownHalfpixel) gl.uniform2f(this._uDownHalfpixel, 1.0 / srcW, 1.0 / srcH);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this._mipChain[i + 1].unbind();
    }

    // ---- 3. Upsample chain with additive blend: mip[i] -> mip[i-1] -------
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    this._upProgram.bind();
    if (this._uUpInput) gl.uniform1i(this._uUpInput, 0);
    if (this._uUpIntensity) gl.uniform1f(this._uUpIntensity, 1.0);
    for (let i = this._numMips - 1; i > 0; i--) {
      const [srcW, srcH] = this._mipSizes[i];
      const [dstW, dstH] = this._mipSizes[i - 1];
      this._mipChain[i - 1].bind(gl.RGBA16F);
      gl.viewport(0, 0, dstW, dstH);
      this._mipChain[i].getTexture().bind(0);
      if (this._uUpHalfpixel) gl.uniform2f(this._uUpHalfpixel, 1.0 / srcW, 1.0 / srcH);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this._mipChain[i - 1].unbind();
    }

    // ---- 4. Final additive composite: mip[0] -> HDR target ---------------
    hdrTarget.bind(sceneW, sceneH);
    gl.viewport(0, 0, sceneW, sceneH);
    this._mipChain[0].getTexture().bind(0);
    if (this._uUpIntensity) gl.uniform1f(this._uUpIntensity, bloom.intensity);
    if (this._uUpHalfpixel) gl.uniform2f(this._uUpHalfpixel, 1.0 / this._mipSizes[0][0], 1.0 / this._mipSizes[0][1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);

    rc.lastProgramId = -1; // force scene programs to rebind next frame
  }

  destroy(): void {
    this._prefilterProgram?.destroy();
    this._downProgram?.destroy();
    this._upProgram?.destroy();
    this._prefilterProgram = null;
    this._downProgram = null;
    this._upProgram = null;
    for (const buf of this._mipChain) buf.destroy();
    this._mipChain.length = 0;
    this._mipSizes.length = 0;
  }

  /**
   * Allocates/resizes the mip chain for the current scene resolution. Each
   * level is half the size of the previous, starting at half scene size, and
   * stops before any dimension collapses to 0.
   */
  private _ensureMipChain(sceneW: number, sceneH: number): void {
    // How many levels can we actually afford at this resolution? With
    // halving, `N` levels needs min(w, h) / 2^N ≥ 2.
    let width = Math.max(2, Math.floor(sceneW / 2));
    let height = Math.max(2, Math.floor(sceneH / 2));
    const levels: Array<[number, number]> = [];
    for (let i = 0; i < this._numMips; i++) {
      if (width < 2 || height < 2) break;
      levels.push([width, height]);
      width = Math.max(2, Math.floor(width / 2));
      height = Math.max(2, Math.floor(height / 2));
    }

    // Create missing buffers on first use or after destroy().
    while (this._mipChain.length < levels.length) {
      const buf = new WebGLRenderBuffer(
        this._renderContext.webglCanvasElement,
        this._renderContext.gl,
        {depthTexture: false, colorFilter: "linear"}
      );
      this._mipChain.push(buf);
    }

    // Snap each existing buffer's size to the computed level, and trim
    // any tail if a lower resolution now needs fewer levels.
    while (this._mipChain.length > levels.length) {
      const extra = this._mipChain.pop();
      extra?.destroy();
    }
    this._mipSizes.length = 0;
    for (let i = 0; i < levels.length; i++) {
      this._mipChain[i].setSize(levels[i]);
      this._mipSizes.push(levels[i]);
    }
  }
}

// ---- Fullscreen triangle VS (shared) -------------------------------------
const VS_FULLSCREEN = `#version 300 es
precision highp float;

out vec2 vUV;

void main(void) {
    vec2 pos = vec2(
        float((gl_VertexID & 1) << 2) - 1.0,
        float((gl_VertexID & 2) << 1) - 1.0
    );
    vUV = pos * 0.5 + 0.5;
    gl_Position = vec4(pos, 0.0, 1.0);
}`;

// ---- Prefilter: soft-knee luminance threshold ----------------------------
// `knee` gives a smooth roll-in around `threshold`, preventing hard-edged
// halos where bright pixels are only just over the cutoff.
const FS_PREFILTER = `#version 300 es
precision highp float;
precision highp sampler2D;

in  vec2 vUV;
out vec4 outColor;

uniform sampler2D uInput;
uniform float     uThreshold;
uniform float     uKnee;

float softKnee(float b, float t, float k) {
    // Unreal-style soft-knee curve: smooth ramp from 0 to 1 over a width
    // of "k" around "t", hard cut above.
    float soft = clamp(b - t + k, 0.0, 2.0 * k);
    soft = (soft * soft) / (4.0 * k + 1e-5);
    float hard = max(b - t, 0.0);
    return max(soft, hard);
}

void main(void) {
    vec3 rgb = texture(uInput, vUV).rgb;
    float brightness = max(rgb.r, max(rgb.g, rgb.b));
    float contrib = softKnee(brightness, uThreshold, uKnee) / max(brightness, 1e-5);
    outColor = vec4(rgb * contrib, 1.0);
}`;

// ---- Kawase 5-tap downsample ---------------------------------------------
const FS_DOWN = `#version 300 es
precision highp float;
precision highp sampler2D;

in  vec2 vUV;
out vec4 outColor;

uniform sampler2D uInput;
uniform vec2      uHalfpixel;

void main(void) {
    vec4 sum = texture(uInput, vUV) * 4.0;
    sum += texture(uInput, vUV - uHalfpixel.xy);
    sum += texture(uInput, vUV + uHalfpixel.xy);
    sum += texture(uInput, vUV + vec2( uHalfpixel.x, -uHalfpixel.y));
    sum += texture(uInput, vUV + vec2(-uHalfpixel.x,  uHalfpixel.y));
    outColor = vec4(sum.rgb / 8.0, 1.0);
}`;

// ---- Kawase 8-tap tent upsample ------------------------------------------
const FS_UP = `#version 300 es
precision highp float;
precision highp sampler2D;

in  vec2 vUV;
out vec4 outColor;

uniform sampler2D uInput;
uniform vec2      uHalfpixel;
uniform float     uIntensity;

void main(void) {
    vec4 sum = texture(uInput, vUV + vec2(-uHalfpixel.x * 2.0, 0.0));
    sum += texture(uInput, vUV + vec2(-uHalfpixel.x,  uHalfpixel.y)) * 2.0;
    sum += texture(uInput, vUV + vec2(0.0,  uHalfpixel.y * 2.0));
    sum += texture(uInput, vUV + vec2( uHalfpixel.x,  uHalfpixel.y)) * 2.0;
    sum += texture(uInput, vUV + vec2( uHalfpixel.x * 2.0, 0.0));
    sum += texture(uInput, vUV + vec2( uHalfpixel.x, -uHalfpixel.y)) * 2.0;
    sum += texture(uInput, vUV + vec2(0.0, -uHalfpixel.y * 2.0));
    sum += texture(uInput, vUV + vec2(-uHalfpixel.x, -uHalfpixel.y)) * 2.0;
    outColor = vec4(sum.rgb / 12.0 * uIntensity, 1.0);
}`;
