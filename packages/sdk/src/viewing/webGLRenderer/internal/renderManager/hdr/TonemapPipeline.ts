import type {RenderContext} from "../../RenderContext";
import type {WebGLAbstractTexture} from "../../../../../base/webGL";
import type {View} from "../../../../viewer";

import {WebGLProgram} from "../../../../../base/webGL";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";

const TONEMAP_MODE_NONE = 0;
const TONEMAP_MODE_REINHARD = 1;
const TONEMAP_MODE_ACES = 2;

/**
 * Fullscreen post-process that samples the HDR scene texture and writes the
 * final LDR result to whatever framebuffer is currently bound (the default
 * canvas, in the normal case).
 *
 * Initial retrofit ships an identity copy — i.e. the tonemap maths is the
 * conceptual no-op `out = in`. That keeps the visible result unchanged from
 * the pre-HDR renderer while the plumbing lands. The shader is the right
 * place to plug in ACES (or similar) once bright-value sources like bloom
 * start arriving in the HDR target.
 *
 * Uses a 3-vertex fullscreen triangle driven by `gl_VertexID`, so there are
 * no vertex buffers to manage.
 *
 * @internal
 */
export class TonemapPipeline {

  private readonly _renderContext: RenderContext;
  private _program: WebGLProgram | null = null;
  private _uHDR: WebGLUniformLocation | null = null;
  private _uExposure: WebGLUniformLocation | null = null;
  private _uTonemapMode: WebGLUniformLocation | null = null;
  private _uSRGBEncode: WebGLUniformLocation | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Compiles the fullscreen tonemap shader.
   *
   * Returns an `InitializationFailed` {@link base!core.SDKResult | SDKResult} if the program fails
   * to compile or link. The caller treats that as "fall back to LDR".
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
        error: `[TonemapPipeline.init] Shader compile/link failed: ${result.error}`
      };
    }

    this._program = program;
    this._uHDR = program.getSampler("uHDR");
    this._uExposure = program.getLocation("uExposure");
    this._uTonemapMode = program.getLocation("uTonemapMode");
    this._uSRGBEncode = program.getLocation("uSRGBEncode");
    return {ok: true, value: undefined};
  }

  /**
   * Draws the HDR texture across the bound framebuffer. Assumes the caller
   * has already bound the final target (usually the default canvas) and set
   * the viewport. Uniforms are read from `view.effects.tonemap`.
   */
  render(params: { hdrTexture: WebGLAbstractTexture; view: View }): void {
    if (!this._program) return;
    const gl = this._renderContext.gl;
    const tonemap = params.view.effects.tonemap;

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    this._program.bind();
    this._renderContext.lastProgramId = -1; // main scene programs re-bind next frame

    // When the active render mode is outside Tonemap.renderModes the
    // pass still has to run (it's the HDR→canvas composite), but it
    // collapses to an identity copy so the View's "fast" mode looks
    // the same as the pre-HDR output.
    const active = tonemap.applied && tonemap.possible;
    params.hdrTexture.bind(0);
    if (this._uHDR) {
      gl.uniform1i(this._uHDR, 0);
    }
    if (this._uExposure) {
      gl.uniform1f(this._uExposure, active ? tonemap.exposure : 1.0);
    }
    if (this._uTonemapMode) {
      gl.uniform1i(this._uTonemapMode, modeToInt(active ? tonemap.mode : "none"));
    }
    if (this._uSRGBEncode) {
      // sRGB encode is independent of the active render mode — the
      // swap chain expects gamma-encoded values either way.
      gl.uniform1i(this._uSRGBEncode, tonemap.sRGBEncode ? 1 : 0);
    }

    // 3 vertices form a screen-covering triangle (gl_VertexID drives positions).
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Restore the default state the rest of the frame expects.
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  destroy(): void {
    this._program?.destroy();
    this._program = null;
    this._uHDR = null;
    this._uExposure = null;
    this._uTonemapMode = null;
    this._uSRGBEncode = null;
  }
}

function modeToInt(mode: string): number {
  if (mode === "reinhard") return TONEMAP_MODE_REINHARD;
  if (mode === "aces") return TONEMAP_MODE_ACES;
  return TONEMAP_MODE_NONE;
}

const VS_SRC = `#version 300 es
precision highp float;

out vec2 vUV;

void main(void) {
    // Map gl_VertexID {0,1,2} onto a single triangle covering all of clip
    // space. Vertex 0 -> (-1,-1), 1 -> (3,-1), 2 -> (-1,3) — the right half of
    // the triangle runs off-screen but the visible square maps UV 0..1.
    vec2 pos = vec2(
        float((gl_VertexID & 1) << 2) - 1.0,
        float((gl_VertexID & 2) << 1) - 1.0
    );
    vUV = pos * 0.5 + 0.5;
    gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FS_SRC = `#version 300 es
precision highp float;

in  vec2 vUV;
out vec4 outColor;

uniform sampler2D uHDR;
uniform float     uExposure;
uniform int       uTonemapMode;   // 0 = none, 1 = reinhard, 2 = aces
uniform int       uSRGBEncode;    // 0 = no, 1 = yes

vec3 reinhard(vec3 c) {
    return c / (c + vec3(1.0));
}

vec3 aces(vec3 c) {
    // Stephen Hill's fit of the ACES RRT + ODT curve.
    return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
}

void main(void) {
    vec3 c = texture(uHDR, vUV).rgb * uExposure;

    if (uTonemapMode == 1) {
        c = reinhard(c);
    } else if (uTonemapMode == 2) {
        c = aces(c);
    }

    if (uSRGBEncode == 1) {
        c = pow(c, vec3(1.0 / 2.2));
    }

    outColor = vec4(c, 1.0);
}`;
