import type {RenderContext} from "../../RenderContext";
import type {WebGLAbstractTexture} from "../../../../webglutils";

import {WebGLProgram} from "../../../../webglutils";
import {SDKErrorType, type SDKResult} from "../../../../core";

/**
 * Fullscreen FXAA (Fast Approximate Antialiasing) post-process.
 *
 * Reads a tonemapped LDR texture, detects high-luma-contrast edges, and blurs
 * along edge direction to soften jaggies. Writes to whatever framebuffer is
 * currently bound — normally the canvas.
 *
 * Single fullscreen triangle driven by `gl_VertexID`; no VBOs. The AA cost is
 * one extra fullscreen pass per frame, which is cheap compared to the scene
 * itself in most viewers.
 *
 * @internal
 */
export class FXAAPipeline {

  private readonly _renderContext: RenderContext;
  private _program: WebGLProgram | null = null;
  private _uInput: WebGLUniformLocation | null = null;
  private _uInverseViewport: WebGLUniformLocation | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Compiles the FXAA shader.
   *
   * Returns `InitializationFailed` if compile/link fails. The caller should
   * treat that as "fall back to no AA".
   */
  init(): SDKResult<void> {
    const program = new WebGLProgram(this._renderContext, {
      vertex: VS_SRC,
      fragment: FS_SRC
    });

    const result = program.init();
    if (result.ok === false) {
      program.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[FXAAPipeline.init] Shader compile/link failed: ${result.error}`
      };
    }

    this._program = program;
    this._uInput = program.getSampler("uInput");
    this._uInverseViewport = program.getLocation("uInverseViewport");
    return {ok: true, value: undefined};
  }

  /**
   * Runs FXAA on the given input texture into the currently-bound framebuffer.
   * Caller sets the viewport beforehand.
   */
  render(params: { inputTexture: WebGLAbstractTexture; viewportWidth: number; viewportHeight: number }): void {
    if (!this._program) return;
    const gl = this._renderContext.gl;

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    this._program.bind();
    this._renderContext.lastProgramId = -1;

    params.inputTexture.bind(0);
    if (this._uInput) {
      gl.uniform1i(this._uInput, 0);
    }
    if (this._uInverseViewport) {
      const invW = params.viewportWidth > 0 ? 1.0 / params.viewportWidth : 0;
      const invH = params.viewportHeight > 0 ? 1.0 / params.viewportHeight : 0;
      gl.uniform2f(this._uInverseViewport, invW, invH);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  destroy(): void {
    this._program?.destroy();
    this._program = null;
    this._uInput = null;
    this._uInverseViewport = null;
  }
}

const VS_SRC = `#version 300 es
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

// Simplified FXAA 3.x (Timothy Lottes / NVIDIA-style), enough to clean up
// geometric edges at very low cost. The tuning constants are the standard
// defaults and work well for general scenes.
const FS_SRC = `#version 300 es
precision highp float;

in  vec2 vUV;
out vec4 outColor;

uniform sampler2D uInput;
uniform vec2      uInverseViewport;  // 1.0 / viewport size in pixels

const float FXAA_SPAN_MAX           = 8.0;
const float FXAA_REDUCE_MUL         = 1.0 / 8.0;
const float FXAA_REDUCE_MIN         = 1.0 / 128.0;
// Edge-detection thresholds (NVIDIA defaults). Pixels whose local luma range
// is below these are pass-through, so flat regions stay identical to the
// input and the visible AA effect is concentrated at actual silhouettes.
const float FXAA_EDGE_THRESHOLD_MIN = 1.0 / 32.0;
const float FXAA_EDGE_THRESHOLD     = 1.0 /  8.0;

float luma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

void main(void) {
    vec3 rgbNW = texture(uInput, vUV + vec2(-1.0, -1.0) * uInverseViewport).rgb;
    vec3 rgbNE = texture(uInput, vUV + vec2( 1.0, -1.0) * uInverseViewport).rgb;
    vec3 rgbSW = texture(uInput, vUV + vec2(-1.0,  1.0) * uInverseViewport).rgb;
    vec3 rgbSE = texture(uInput, vUV + vec2( 1.0,  1.0) * uInverseViewport).rgb;
    vec3 rgbM  = texture(uInput, vUV).rgb;

    float lumaNW = luma(rgbNW);
    float lumaNE = luma(rgbNE);
    float lumaSW = luma(rgbSW);
    float lumaSE = luma(rgbSE);
    float lumaM  = luma(rgbM);

    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
    float lumaRange = lumaMax - lumaMin;

    // Early-out for non-edge pixels. Without this FXAA lightly blurs every
    // pixel, which makes the "on" state feel like a vague overall softening
    // instead of targeted edge cleanup.
    if (lumaRange < max(FXAA_EDGE_THRESHOLD_MIN, lumaMax * FXAA_EDGE_THRESHOLD)) {
        outColor = vec4(rgbM, 1.0);
        return;
    }

    // Edge direction from luma gradients of the 4 corners.
    vec2 dir;
    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcpDirMin, vec2(-FXAA_SPAN_MAX), vec2(FXAA_SPAN_MAX)) * uInverseViewport;

    vec3 rgbA = 0.5 * (
        texture(uInput, vUV + dir * (1.0/3.0 - 0.5)).rgb +
        texture(uInput, vUV + dir * (2.0/3.0 - 0.5)).rgb
    );
    vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture(uInput, vUV + dir * -0.5).rgb +
        texture(uInput, vUV + dir *  0.5).rgb
    );

    // If the 4-tap average fell outside the neighbourhood luma range, it's
    // an over-smooth; fall back to the 2-tap average to preserve detail.
    float lumaB = luma(rgbB);
    vec3  rgb   = (lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB;

    outColor = vec4(rgb, 1.0);
}`;
