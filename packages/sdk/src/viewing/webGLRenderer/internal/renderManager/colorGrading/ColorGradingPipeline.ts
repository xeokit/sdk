import type {RenderContext} from "../../RenderContext";
import type {WebGLAbstractTexture} from "../../webGL";
import type {View} from "../../../../viewer";

import {WebGLProgram, WebGLRenderBuffer} from "../../webGL";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";

/**
 * Single-pass HDR color grading post-process.
 *
 * Reads the current HDR scene color, applies the View's
 * {@link ColorGrading} settings, and writes an HDR target for the final
 * tonemap pass.
 *
 * @internal
 */
export class ColorGradingPipeline {

  private readonly _renderContext: RenderContext;
  private _program: WebGLProgram | null = null;
  private _target: WebGLRenderBuffer | null = null;

  private _uColor: WebGLUniformLocation | null = null;
  private _uBrightness: WebGLUniformLocation | null = null;
  private _uContrast: WebGLUniformLocation | null = null;
  private _uSaturation: WebGLUniformLocation | null = null;
  private _uGamma: WebGLUniformLocation | null = null;
  private _uTemperature: WebGLUniformLocation | null = null;
  private _uTint: WebGLUniformLocation | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

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
        error: `[ColorGradingPipeline.init] Shader compile/link failed: ${result.error}`
      };
    }

    this._program = program;
    this._uColor = program.getSampler("uColor");
    this._uBrightness = program.getLocation("uBrightness");
    this._uContrast = program.getLocation("uContrast");
    this._uSaturation = program.getLocation("uSaturation");
    this._uGamma = program.getLocation("uGamma");
    this._uTemperature = program.getLocation("uTemperature");
    this._uTint = program.getLocation("uTint");
    return {ok: true, value: undefined};
  }

  /**
   * Runs color grading into an internal HDR target and returns that target's
   * colour texture. Returns null when the pass is not ready or the frame size
   * is invalid.
   */
  render(params: {
    colorTexture: WebGLAbstractTexture;
    view: View;
  }): WebGLAbstractTexture | null {
    if (!this._program) return null;

    const rc = this._renderContext;
    const gl = rc.gl;
    const sceneW = rc.sceneRenderWidth || gl.drawingBufferWidth;
    const sceneH = rc.sceneRenderHeight || gl.drawingBufferHeight;
    if (sceneW <= 0 || sceneH <= 0) return null;

    if (!this._target) {
      this._target = new WebGLRenderBuffer(
        rc.webglCanvasElement,
        gl,
        {
          depthTexture: false,
          colorFilter: "linear"
        }
      );
    }

    this._target.setSize([sceneW, sceneH]);
    this._target.bind(gl.RGBA16F);
    gl.viewport(0, 0, sceneW, sceneH);

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    this._program.bind();
    rc.resetTextureBindings();
    rc.lastProgramId = -1;

    params.colorTexture.bind(0);

    const colorGrading = params.view.effects.colorGrading;

    if (this._uColor) gl.uniform1i(this._uColor, 0);
    if (this._uBrightness) gl.uniform1f(this._uBrightness, colorGrading.brightness);
    if (this._uContrast) gl.uniform1f(this._uContrast, colorGrading.contrast);
    if (this._uSaturation) gl.uniform1f(this._uSaturation, colorGrading.saturation);
    if (this._uGamma) gl.uniform1f(this._uGamma, colorGrading.gamma);
    if (this._uTemperature) gl.uniform1f(this._uTemperature, colorGrading.temperature);
    if (this._uTint) gl.uniform1f(this._uTint, colorGrading.tint);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this._target.unbind();
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);

    return this._target.getTexture();
  }

  destroy(): void {
    this._program?.destroy();
    this._program = null;
    this._target?.destroy();
    this._target = null;
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

const FS_SRC = `#version 300 es
precision highp float;
precision highp sampler2D;

in  vec2 vUV;
out vec4 outColor;

uniform sampler2D uColor;
uniform float     uBrightness;
uniform float     uContrast;
uniform float     uSaturation;
uniform float     uGamma;
uniform float     uTemperature;
uniform float     uTint;

float luma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

vec3 applyColorGrading(vec3 colorIn) {
    vec3 color = colorIn + vec3(uBrightness);
    color = (color - vec3(0.5)) * uContrast + vec3(0.5);
    float gray = luma(color);
    color = mix(vec3(gray), color, uSaturation);

    float warm = max(uTemperature, 0.0);
    float cool = max(-uTemperature, 0.0);
    float green = max(uTint, 0.0);
    float magenta = max(-uTint, 0.0);
    color *= vec3(
        1.0 + warm * 0.12 - cool * 0.06 + magenta * 0.04,
        1.0 + green * 0.10 - magenta * 0.06,
        1.0 + cool * 0.12 - warm * 0.06 + magenta * 0.04
    );
    return pow(max(color, vec3(0.0)), vec3(1.0 / max(uGamma, 0.001)));
}

void main(void) {
    vec4 color = texture(uColor, vUV);
    outColor = vec4(applyColorGrading(color.rgb), color.a);
}`;
