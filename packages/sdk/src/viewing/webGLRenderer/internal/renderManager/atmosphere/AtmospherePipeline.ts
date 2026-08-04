import type {RenderContext} from "../../RenderContext";
import type {WebGLAbstractTexture} from "../../webGL";
import type {View} from "../../../../viewer";

import {WebGLProgram, WebGLRenderBuffer} from "../../webGL";
import {OrthoProjectionType, PerspectiveProjectionType} from "../../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";

const PROJECTION_PERSPECTIVE = 0;
const PROJECTION_ORTHO = 1;

/**
 * Single-pass HDR atmospheric attenuation post-process.
 *
 * Reads HDR scene colour plus a matching scene-depth texture and fades distant
 * geometry toward the View's {@link Atmosphere} haze colour. Tonemap samples
 * the returned texture.
 *
 * @internal
 */
export class AtmospherePipeline {

  private readonly _renderContext: RenderContext;
  private _program: WebGLProgram | null = null;
  private _target: WebGLRenderBuffer | null = null;

  private _uColor: WebGLUniformLocation | null = null;
  private _uDepth: WebGLUniformLocation | null = null;
  private _uNear: WebGLUniformLocation | null = null;
  private _uFar: WebGLUniformLocation | null = null;
  private _uLogDepth: WebGLUniformLocation | null = null;
  private _uProjectionType: WebGLUniformLocation | null = null;
  private _uFogColor: WebGLUniformLocation | null = null;
  private _uStartDistance: WebGLUniformLocation | null = null;
  private _uEndDistance: WebGLUniformLocation | null = null;
  private _uIntensity: WebGLUniformLocation | null = null;
  private _uMaxOpacity: WebGLUniformLocation | null = null;
  private _uAffectSky: WebGLUniformLocation | null = null;

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
        error: `[AtmospherePipeline.init] Shader compile/link failed: ${result.error}`
      };
    }

    this._program = program;
    this._uColor = program.getSampler("uColor");
    this._uDepth = program.getSampler("uDepth");
    this._uNear = program.getLocation("uNear");
    this._uFar = program.getLocation("uFar");
    this._uLogDepth = program.getLocation("uLogDepth");
    this._uProjectionType = program.getLocation("uProjectionType");
    this._uFogColor = program.getLocation("uFogColor");
    this._uStartDistance = program.getLocation("uStartDistance");
    this._uEndDistance = program.getLocation("uEndDistance");
    this._uIntensity = program.getLocation("uIntensity");
    this._uMaxOpacity = program.getLocation("uMaxOpacity");
    this._uAffectSky = program.getLocation("uAffectSky");
    return {ok: true, value: undefined};
  }

  /**
   * Runs atmosphere into an internal HDR target and returns that target's
   * colour texture. Returns null when the pass is not ready or the frame size
   * is invalid.
   */
  render(params: {
    colorTexture: WebGLAbstractTexture;
    depthTexture: WebGLAbstractTexture;
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
    params.depthTexture.bind(1);

    const camera = params.view.camera;
    const projectionInfo = getProjectionInfo(camera);
    const atmosphere = params.view.effects.atmosphere;
    const color = atmosphere.color;

    if (this._uColor) gl.uniform1i(this._uColor, 0);
    if (this._uDepth) gl.uniform1i(this._uDepth, 1);
    if (this._uNear) gl.uniform1f(this._uNear, projectionInfo.near);
    if (this._uFar) gl.uniform1f(this._uFar, projectionInfo.far);
    if (this._uLogDepth) gl.uniform1i(this._uLogDepth, 1);
    if (this._uProjectionType) gl.uniform1i(this._uProjectionType, projectionInfo.projectionType);
    if (this._uFogColor) gl.uniform3f(this._uFogColor, color[0], color[1], color[2]);
    if (this._uStartDistance) gl.uniform1f(this._uStartDistance, atmosphere.startDistance);
    if (this._uEndDistance) gl.uniform1f(this._uEndDistance, atmosphere.endDistance);
    if (this._uIntensity) gl.uniform1f(this._uIntensity, atmosphere.intensity);
    if (this._uMaxOpacity) gl.uniform1f(this._uMaxOpacity, atmosphere.maxOpacity);
    if (this._uAffectSky) gl.uniform1i(this._uAffectSky, atmosphere.affectSky ? 1 : 0);

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

function getProjectionInfo(camera: any): {near: number; far: number; projectionType: number} {
  if (camera.projectionType === OrthoProjectionType) {
    return {
      near: camera.orthoProjection.near,
      far: camera.orthoProjection.far,
      projectionType: PROJECTION_ORTHO
    };
  }
  if (camera.projectionType === PerspectiveProjectionType) {
    return {
      near: camera.perspectiveProjection.near,
      far: camera.perspectiveProjection.far,
      projectionType: PROJECTION_PERSPECTIVE
    };
  }
  const projection = camera.perspectiveProjection;
  return {
    near: projection.near,
    far: projection.far,
    projectionType: PROJECTION_PERSPECTIVE
  };
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
uniform sampler2D uDepth;
uniform float     uNear;
uniform float     uFar;
uniform int       uLogDepth;
uniform int       uProjectionType; // 0 = perspective, 1 = orthographic
uniform vec3      uFogColor;
uniform float     uStartDistance;
uniform float     uEndDistance;
uniform float     uIntensity;
uniform float     uMaxOpacity;
uniform int       uAffectSky;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float linearizeDepth(float depth) {
    depth = clamp(depth, 0.0, 1.0);
    if (uLogDepth == 1) {
        return exp2(depth * log2(uFar + 1.0)) - 1.0;
    }
    if (uProjectionType == 1) {
        return mix(uNear, uFar, depth);
    }
    float z = depth * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / max(uFar + uNear - z * (uFar - uNear), 1e-5);
}

void main(void) {
    vec4 color = texture(uColor, vUV);
    float rawDepth = texture(uDepth, vUV).r;
    if (uAffectSky == 0 && rawDepth >= 0.999999) {
        outColor = color;
        return;
    }

    float viewDepth = linearizeDepth(rawDepth);
    float range = max(uEndDistance - uStartDistance, 1e-4);
    float distanceAmount = smoothstep(0.0, 1.0, clamp((viewDepth - uStartDistance) / range, 0.0, 1.0));
    float haze = min(uMaxOpacity, distanceAmount * uIntensity);
    vec3 airlight = clamp(uFogColor, vec3(0.0), vec3(1.0));
    vec3 fogged = mix(color.rgb, airlight, haze);

    float sourceLuma = dot(color.rgb, LUMA);
    float foggedLuma = dot(fogged, LUMA);
    float minLuma = sourceLuma * (1.0 - haze * 0.08);
    if (foggedLuma < minLuma) {
        fogged *= minLuma / max(foggedLuma, 1e-5);
    }
    outColor = vec4(fogged, color.a);
}`;
