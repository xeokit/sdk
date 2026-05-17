import type {RenderContext} from "../../RenderContext";

import {WebGLProgram} from "../../../../../base/webGL";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import {MAX_SECTION_PLANES} from "../../drawOps/DrawTechnique";

/**
 * Renders a single section-plane cap as a fullscreen triangle.
 *
 * Companion to the stencil-mask pass:
 *   1. Two invisible {@link TrianglesStencilMaskTechnique} draws
 *      (front-cull DECR, back-cull INCR) write a non-zero
 *      stencil count at every pixel where the camera ray crosses
 *      the model AND the cap plane is between the camera and
 *      the exit point.
 *   2. This renderer draws a fullscreen quad with
 *      `stencilFunc(NOTEQUAL, 0, 0xFF)`. The FS reconstructs the
 *      camera ray for each pixel, intersects it with the cap
 *      plane in world space, writes the intersection's NDC z
 *      to `gl_FragDepth`, and outputs the cap colour.
 *
 * Effect: the cap appears as a flat surface at the cut plane,
 * only where the model is actually intersected — no back-face
 * silhouette artefacts.
 *
 * @internal
 */
export class CapPlaneRenderer {

  private readonly _renderContext: RenderContext;
  private _program: WebGLProgram | null = null;

  private _uInvViewProj: WebGLUniformLocation | null = null;
  private _uViewProj: WebGLUniformLocation | null = null;
  private _uEyeWorldPos: WebGLUniformLocation | null = null;
  private _uCapPlane: WebGLUniformLocation | null = null;
  private _uCapColor: WebGLUniformLocation | null = null;
  private _uViewport: WebGLUniformLocation | null = null;
  // Sibling banks to the model FS — the cap-quad FS reapplies the
  // union clip of the OTHER active section planes against the
  // cap-plane intersection's world position. The stencil mask is
  // intentionally permissive (it only sees the cap plane) so the
  // count stays balanced; we filter the cap's actual visible region
  // here in screen space, where each fragment knows the cap's
  // 3D position exactly.
  private _uOtherPlanes: WebGLUniformLocation | null = null;
  private _uOtherPlaneCount: WebGLUniformLocation | null = null;

  /** Scratch buffer for the per-frame "other planes" upload. */
  private readonly _otherScratch = new Float32Array(MAX_SECTION_PLANES * 4);

  private readonly _scratchInvVP = new Float32Array(16);
  private readonly _scratchVP = new Float32Array(16);

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Compiles the cap shader.
   *
   * Returns `InitializationFailed` if compile/link fails. The
   * caller treats that as "cap pass disabled", same as other
   * post-process pipelines.
   */
  init(): SDKResult<void> {
    const program = new WebGLProgram(this._renderContext, {
      vertex: VS_SRC,
      fragment: FS_SRC,
    });
    const result = program.init();
    if (result.ok === false) {
      program.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[CapPlaneRenderer.init] Shader compile/link failed: ${result.error}`,
      };
    }
    this._program = program;
    this._uInvViewProj = program.getLocation("uInvViewProj");
    this._uViewProj = program.getLocation("uViewProj");
    this._uEyeWorldPos = program.getLocation("uEyeWorldPos");
    this._uCapPlane = program.getLocation("uCapPlane");
    this._uCapColor = program.getLocation("uCapColor");
    this._uViewport = program.getLocation("uViewport");
    this._uOtherPlanes = program.getLocation("uOtherPlanes[0]");
    this._uOtherPlaneCount = program.getLocation("uOtherPlaneCount");
    return {ok: true, value: undefined};
  }

  /**
   * Draws one cap. Caller has already set the stencil func to
   * NOTEQUAL 0 and cleared the per-plane stencil counters; the
   * fragments that survive the stencil test paint the cap.
   */
  render(params: {
    viewProj: Float32Array | number[];
    eyeWorldPos: Float32Array | number[];
    capPlaneNormal: Float32Array | number[];
    capPlaneDist: number;
    capColor: Float32Array | number[];
    viewportWidth: number;
    viewportHeight: number;
    /** Active section planes EXCEPT the cap target — used to
     *  reapply the union clip on the cap intersection's world pos. */
    otherPlanes: ReadonlyArray<{dir: ArrayLike<number>; dist: number}>;
  }): void {
    if (!this._program) return;
    const gl = this._renderContext.gl;

    this._program.bind();
    // Force the next standard `_bind()` in DrawTechnique to
    // re-upload its uniforms — we just stomped the program slot.
    this._renderContext.lastProgramId = -1;

    invertMat4(params.viewProj as any, this._scratchInvVP);
    for (let i = 0; i < 16; i++) this._scratchVP[i] = (params.viewProj as any)[i];

    if (this._uInvViewProj) gl.uniformMatrix4fv(this._uInvViewProj, false, this._scratchInvVP);
    if (this._uViewProj)    gl.uniformMatrix4fv(this._uViewProj,    false, this._scratchVP);
    if (this._uEyeWorldPos) gl.uniform3f(this._uEyeWorldPos,
      params.eyeWorldPos[0], params.eyeWorldPos[1], params.eyeWorldPos[2]);
    if (this._uCapPlane) gl.uniform4f(this._uCapPlane,
      params.capPlaneNormal[0], params.capPlaneNormal[1], params.capPlaneNormal[2], params.capPlaneDist);
    if (this._uCapColor) gl.uniform3f(this._uCapColor,
      params.capColor[0], params.capColor[1], params.capColor[2]);
    if (this._uViewport) gl.uniform2f(this._uViewport,
      params.viewportWidth, params.viewportHeight);

    const others = params.otherPlanes;
    const otherCount = Math.min(others.length, MAX_SECTION_PLANES);
    for (let i = 0; i < otherCount; i++) {
      const p = others[i];
      this._otherScratch[i * 4 + 0] = p.dir[0];
      this._otherScratch[i * 4 + 1] = p.dir[1];
      this._otherScratch[i * 4 + 2] = p.dir[2];
      this._otherScratch[i * 4 + 3] = p.dist;
    }
    if (this._uOtherPlaneCount) gl.uniform1i(this._uOtherPlaneCount, otherCount);
    if (this._uOtherPlanes && otherCount > 0) {
      gl.uniform4fv(this._uOtherPlanes, this._otherScratch);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy(): void {
    this._program?.destroy();
    this._program = null;
  }
}

const VS_SRC = `#version 300 es
precision highp float;

void main(void) {
    // Three-vertex fullscreen triangle (Bjorke / Lottes pattern).
    vec2 pos = vec2(
        float((gl_VertexID & 1) << 2) - 1.0,
        float((gl_VertexID & 2) << 1) - 1.0
    );
    gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FS_SRC = `#version 300 es
precision highp float;
precision highp int;

const int MAX_SECTION_PLANES = ${MAX_SECTION_PLANES};

uniform mat4  uInvViewProj;
uniform mat4  uViewProj;
uniform vec3  uEyeWorldPos;
uniform vec4  uCapPlane;     // (normal.xyz, d) — dot(n, p) + d > 0 ⇒ clipped
uniform vec3  uCapColor;
uniform vec2  uViewport;     // pixels
// OTHER active section planes — used to mask the cap to where the
// visible model would have existed. Each entry packed (normal.xyz, d)
// the same way the model FS reads them.
uniform vec4  uOtherPlanes[MAX_SECTION_PLANES];
uniform int   uOtherPlaneCount;

out vec4 outColor;

void main(void) {
    // Reconstruct the camera ray for this pixel.
    // gl_FragCoord is in window coords (origin lower-left for WebGL).
    vec2 ndcXY = (gl_FragCoord.xy / uViewport) * 2.0 - 1.0;
    // Far-plane homogeneous point. Multiplying invViewProj * vec4(ndc, 1, 1)
    // and homogeneous-dividing gives the world-space point that sits on the
    // far plane along this pixel's ray.
    vec4 worldFarH = uInvViewProj * vec4(ndcXY, 1.0, 1.0);
    vec3 worldFar  = worldFarH.xyz / worldFarH.w;
    vec3 rayDir    = worldFar - uEyeWorldPos;

    // Plane intersection: eye + t * rayDir lies on the plane when
    // dot(n, eye + t*dir) + d = 0 ⇒ t = -(dot(n, eye) + d) / dot(n, dir).
    float denom = dot(uCapPlane.xyz, rayDir);
    // Edge-on view of the plane — no valid cap depth at this pixel.
    if (abs(denom) < 1e-6) discard;
    float t = -(dot(uCapPlane.xyz, uEyeWorldPos) + uCapPlane.w) / denom;
    // Plane is behind the camera (or exactly at it) for this pixel.
    if (t <= 0.0) discard;

    vec3 worldPos = uEyeWorldPos + t * rayDir;

    // Union-clip the cap against the other active planes: if the
    // cap's 3D position is in any other plane's clipped half-space,
    // the visible model doesn't extend to here and the cap shouldn't
    // render. This is the multi-plane equivalent of "cap appears
    // only where the plane physically crosses the model".
    for (int i = 0; i < uOtherPlaneCount; i++) {
      if (dot(uOtherPlanes[i].xyz, worldPos) + uOtherPlanes[i].w > 0.0) discard;
    }

    // Project the world-space intersection back to clip space to
    // get the correct NDC depth, then map to window depth [0, 1].
    vec4 clip = uViewProj * vec4(worldPos, 1.0);
    if (clip.w <= 0.0) discard;
    float ndcZ = clip.z / clip.w;
    // Outside near/far frustum.
    if (ndcZ < -1.0 || ndcZ > 1.0) discard;
    gl_FragDepth = ndcZ * 0.5 + 0.5;

    outColor = vec4(uCapColor, 1.0);
}`;

/**
 * 4x4 inverse in column-major (Float32Array) layout, matching the
 * View's projection / camera matrix convention. Adapted from the
 * standard cofactor expansion — small, branch-free, no allocation.
 */
function invertMat4(m: ArrayLike<number>, out: Float32Array): void {
  const a00 = m[0], a01 = m[1], a02 = m[2],  a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6],  a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12],a31 = m[13],a32 = m[14], a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    // Degenerate — fill with identity so the caller doesn't crash;
    // the corresponding cap won't render correctly but at least
    // won't take the renderer down with it.
    for (let i = 0; i < 16; i++) out[i] = (i % 5 === 0) ? 1 : 0;
    return;
  }
  det = 1.0 / det;

  out[0]  = ( a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1]  = (-a01 * b11 + a02 * b10 - a03 * b09) * det;
  out[2]  = ( a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3]  = (-a21 * b05 + a22 * b04 - a23 * b03) * det;
  out[4]  = (-a10 * b11 + a12 * b08 - a13 * b07) * det;
  out[5]  = ( a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6]  = (-a30 * b05 + a32 * b02 - a33 * b01) * det;
  out[7]  = ( a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8]  = ( a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9]  = (-a00 * b10 + a01 * b08 - a03 * b06) * det;
  out[10] = ( a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * det;
  out[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * det;
  out[13] = ( a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * det;
  out[15] = ( a20 * b03 - a21 * b01 + a22 * b00) * det;
}
