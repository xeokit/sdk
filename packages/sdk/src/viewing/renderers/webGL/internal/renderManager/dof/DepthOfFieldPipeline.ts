import type {RenderContext} from "../../RenderContext";
import type {WebGLAbstractTexture} from "../../webGL";
import type {View} from "../../../../../viewer";

import {WebGLProgram, WebGLRenderBuffer} from "../../webGL";
import {OrthoProjectionType, PerspectiveProjectionType} from "../../../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../../../base/core";

const PROJECTION_PERSPECTIVE = 0;
const PROJECTION_ORTHO = 1;

/**
 * Single-pass HDR depth-of-field post-process.
 *
 * Reads the HDR scene colour plus a matching scene-depth texture, computes a
 * circle-of-confusion from the View's {@link DepthOfField} settings, and
 * writes blurred HDR colour to an internal RGBA16F target. Tonemap samples the
 * returned texture.
 *
 * @internal
 */
export class DepthOfFieldPipeline {

  private readonly _renderContext: RenderContext;
  private _program: WebGLProgram | null = null;
  private _target: WebGLRenderBuffer | null = null;

  private _uColor: WebGLUniformLocation | null = null;
  private _uDepth: WebGLUniformLocation | null = null;
  private _uInverseViewport: WebGLUniformLocation | null = null;
  private _uNear: WebGLUniformLocation | null = null;
  private _uFar: WebGLUniformLocation | null = null;
  private _uLogDepth: WebGLUniformLocation | null = null;
  private _uProjectionType: WebGLUniformLocation | null = null;
  private _uFocusDistance: WebGLUniformLocation | null = null;
  private _uFocalRange: WebGLUniformLocation | null = null;
  private _uRadius: WebGLUniformLocation | null = null;
  private _uIntensity: WebGLUniformLocation | null = null;
  private _uNearBlur: WebGLUniformLocation | null = null;
  private _uFarBlur: WebGLUniformLocation | null = null;

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
        error: `[DepthOfFieldPipeline.init] Shader compile/link failed: ${result.error}`
      };
    }

    this._program = program;
    this._uColor = program.getSampler("uColor");
    this._uDepth = program.getSampler("uDepth");
    this._uInverseViewport = program.getLocation("uInverseViewport");
    this._uNear = program.getLocation("uNear");
    this._uFar = program.getLocation("uFar");
    this._uLogDepth = program.getLocation("uLogDepth");
    this._uProjectionType = program.getLocation("uProjectionType");
    this._uFocusDistance = program.getLocation("uFocusDistance");
    this._uFocalRange = program.getLocation("uFocalRange");
    this._uRadius = program.getLocation("uRadius");
    this._uIntensity = program.getLocation("uIntensity");
    this._uNearBlur = program.getLocation("uNearBlur");
    this._uFarBlur = program.getLocation("uFarBlur");
    return {ok: true, value: undefined};
  }

  /**
   * Runs DOF into an internal HDR target and returns that target's colour
   * texture. Returns null when the pass is not ready or the frame size is
   * invalid.
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
    const dof = params.view.effects.depthOfField;

    if (this._uColor) gl.uniform1i(this._uColor, 0);
    if (this._uDepth) gl.uniform1i(this._uDepth, 1);
    if (this._uInverseViewport) gl.uniform2f(this._uInverseViewport, 1.0 / sceneW, 1.0 / sceneH);
    if (this._uNear) gl.uniform1f(this._uNear, projectionInfo.near);
    if (this._uFar) gl.uniform1f(this._uFar, projectionInfo.far);
    if (this._uLogDepth) gl.uniform1i(this._uLogDepth, 1);
    if (this._uProjectionType) gl.uniform1i(this._uProjectionType, projectionInfo.projectionType);
    if (this._uFocusDistance) gl.uniform1f(this._uFocusDistance, dof.focusDistance);
    if (this._uFocalRange) gl.uniform1f(this._uFocalRange, dof.focalRange);
    if (this._uRadius) gl.uniform1f(this._uRadius, dof.radius);
    if (this._uIntensity) gl.uniform1f(this._uIntensity, dof.intensity);
    if (this._uNearBlur) gl.uniform1f(this._uNearBlur, dof.nearBlur);
    if (this._uFarBlur) gl.uniform1f(this._uFarBlur, dof.farBlur);

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
uniform vec2      uInverseViewport;
uniform float     uNear;
uniform float     uFar;
uniform int       uLogDepth;
uniform int       uProjectionType; // 0 = perspective, 1 = orthographic
uniform float     uFocusDistance;
uniform float     uFocalRange;
uniform float     uRadius;
uniform float     uIntensity;
uniform float     uNearBlur;
uniform float     uFarBlur;

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

float circleOfConfusion(float viewDepth) {
    float range = max(uFocalRange, 1e-4);
    float nearAmount = clamp((uFocusDistance - viewDepth) / range, 0.0, 1.0) * uNearBlur;
    float farAmount = clamp((viewDepth - uFocusDistance) / range, 0.0, 1.0) * uFarBlur;
    return max(nearAmount, farAmount);
}

void addTap(inout vec3 sum, inout float weight, vec2 uv, vec2 dir, float radiusPixels) {
    vec2 tapUV = clamp(uv + dir * uInverseViewport * radiusPixels, vec2(0.0), vec2(1.0));
    float tapDepth = linearizeDepth(texture(uDepth, tapUV).r);
    float tapCoC = circleOfConfusion(tapDepth);
    float tapWeight = 0.35 + tapCoC;
    sum += texture(uColor, tapUV).rgb * tapWeight;
    weight += tapWeight;
}

vec3 sampleBlurred(vec2 uv, float radiusPixels) {
    vec3 sum = texture(uColor, uv).rgb;
    float weight = 1.0;

    addTap(sum, weight, uv, vec2( 0.000,  1.000), radiusPixels);
    addTap(sum, weight, uv, vec2( 0.866,  0.500), radiusPixels);
    addTap(sum, weight, uv, vec2( 0.866, -0.500), radiusPixels);
    addTap(sum, weight, uv, vec2( 0.000, -1.000), radiusPixels);
    addTap(sum, weight, uv, vec2(-0.866, -0.500), radiusPixels);
    addTap(sum, weight, uv, vec2(-0.866,  0.500), radiusPixels);
    addTap(sum, weight, uv, vec2( 0.500,  0.866), radiusPixels);
    addTap(sum, weight, uv, vec2( 1.000,  0.000), radiusPixels);
    addTap(sum, weight, uv, vec2( 0.500, -0.866), radiusPixels);
    addTap(sum, weight, uv, vec2(-0.500, -0.866), radiusPixels);
    addTap(sum, weight, uv, vec2(-1.000,  0.000), radiusPixels);
    addTap(sum, weight, uv, vec2(-0.500,  0.866), radiusPixels);

    return sum / weight;
}

void main(void) {
    vec3 sharp = texture(uColor, vUV).rgb;
    float depth = linearizeDepth(texture(uDepth, vUV).r);
    float coc = circleOfConfusion(depth);
    float radiusPixels = coc * uRadius;

    if (radiusPixels <= 0.01 || uIntensity <= 0.0) {
        outColor = vec4(sharp, 1.0);
        return;
    }

    vec3 blurred = sampleBlurred(vUV, radiusPixels);
    float mixAmount = clamp((radiusPixels / max(uRadius, 1e-4)) * uIntensity, 0.0, 1.0);
    outColor = vec4(mix(sharp, blurred, mixAmount), 1.0);
}`;
