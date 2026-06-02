import {
  createMat4Float64,
  inverseMat4,
  mulMat4,
  type Mat4
} from "../../../../../base/math/matrix";
import type {ViewRenderState} from "../../ViewRenderState";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";

export interface SkyRendererOptions {
  /**
   * Sky zenith color. Default is a medium blue.
   */
  skyColor?: [number, number, number];

  /**
   * Horizon color. Default is a light hazy blue.
   */
  horizonColor?: [number, number, number];

  /**
   * Below-horizon color. Default is a dark earthy tone.
   */
  groundColor?: [number, number, number];

  /**
   * Controls the angular width (in elevation) of the horizon blend band.
   * Larger values give a wider, softer transition. Default is `0.15`.
   */
  horizonBlend?: number;

  /**
   * Whether to render a sun disc and glow. Default is `true`.
   */
  sunEnabled?: boolean;

  /**
   * World-space direction toward the sun (need not be normalized). Default is `[0.577, 0.577, 0.577]`.
   */
  sunDirection?: [number, number, number];

  /**
   * Sun disc and corona color. Default is warm yellow-white.
   */
  sunColor?: [number, number, number];

  /**
   * Angular diameter of the sun disc in degrees. Default is `3.0`.
   */
  sunAngularSize?: number;

  /**
   * Exponent controlling how tightly the glow hugs the sun disc. Higher = tighter. Default is `16`.
   */
  sunGlowSize?: number;

  /**
   * Peak intensity of the sun glow. Default is `0.25`.
   */
  sunGlowIntensity?: number;

  /**
   * World-space "up" direction. Defaults to Z-up `[0,0,1]` to match the Scene default.
   */
  worldUp?: [number, number, number];
}

/**
 * Procedural sky renderer for xeokit V3.
 *
 * Integrated into {@link RenderManager} and drawn once per frame via
 * `render(viewRenderState)` when {@link enabled} is true.
 *
 * Features:
 * - Three-band gradient: zenith sky → horizon → ground
 * - Optional sun disc and radial glow
 * - Horizon haze brightened toward the sun
 * - Coordinate-system-aware via {@link worldUp}
 * - No textures needed — all procedural in GLSL
 *
 * The sky is drawn as a fullscreen quad before any scene geometry, so it
 * always appears as the background regardless of scene content.
 *
 * ```ts
 * const sky = renderManager.sky;
 * sky.enabled = true;
 * sky.skyColor = [0.28, 0.52, 0.93];
 * sky.sunDirection = [0.6, 0.4, 0.7];
 * ```
 */
export class SkyRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly viewProjMatrix: Mat4 = createMat4Float64();
  private readonly invViewProjMatrix: Mat4 = createMat4Float64();
  private readonly _rteViewMatrix: Mat4 = createMat4Float64();
  private readonly _invViewProjF32: Float32Array = new Float32Array(16);

  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  private uInvViewProj: WebGLUniformLocation | null = null;
  private uCameraPos: WebGLUniformLocation | null = null;
  private uWorldUp: WebGLUniformLocation | null = null;
  private uSkyColor: WebGLUniformLocation | null = null;
  private uHorizonColor: WebGLUniformLocation | null = null;
  private uGroundColor: WebGLUniformLocation | null = null;
  private uHorizonBlend: WebGLUniformLocation | null = null;
  private uSunEnabled: WebGLUniformLocation | null = null;
  private uSunDirection: WebGLUniformLocation | null = null;
  private uSunColor: WebGLUniformLocation | null = null;
  private uSunCosSize: WebGLUniformLocation | null = null;
  private uSunGlowSize: WebGLUniformLocation | null = null;
  private uSunGlowIntensity: WebGLUniformLocation | null = null;

  /**
   * When true, {@link RenderManager} will render this sky each frame before scene geometry.
   */
  public enabled: boolean = false;

  /**
   * Sky zenith color.
   */
  public skyColor: [number, number, number];

  /**
   * Horizon color.
   */
  public horizonColor: [number, number, number];

  /**
   * Below-horizon ground color.
   */
  public groundColor: [number, number, number];

  /**
   * Angular width of the horizon blend band (elevation units, ~0–1). Default `0.15`.
   */
  public horizonBlend: number;

  /**
   * Whether to render a sun disc and glow.
   */
  public sunEnabled: boolean;

  /**
   * World-space direction toward the sun (need not be normalized).
   */
  public sunDirection: [number, number, number];

  /**
   * Sun disc and corona color.
   */
  public sunColor: [number, number, number];

  /**
   * Angular diameter of the sun disc in degrees.
   */
  public sunAngularSize: number;

  /**
   * Glow falloff exponent. Higher = tighter glow around the sun disc.
   */
  public sunGlowSize: number;

  /**
   * Peak intensity of the sun glow.
   */
  public sunGlowIntensity: number;

  /**
   * World-space "up" direction. Matches the Scene's `CoordinateSystem.worldUp`.
   * Default is `[0,0,1]` (Z-up), matching the Scene default.
   */
  public worldUp: [number, number, number];

  /**
   * True once `init()` has successfully allocated resources.
   */
  public initialized = false;

  /**
   * True once `destroy()` has been called.
   */
  public destroyed = false;

  constructor(gl: WebGL2RenderingContext, options: SkyRendererOptions = {}) {
    this.gl = gl;
    this.skyColor = options.skyColor ?? [0.28, 0.52, 0.93];
    this.horizonColor = options.horizonColor ?? [0.72, 0.86, 0.97];
    this.groundColor = options.groundColor ?? [0.22, 0.20, 0.18];
    this.horizonBlend = options.horizonBlend ?? 0.15;
    this.sunEnabled = options.sunEnabled ?? true;
    this.sunDirection = options.sunDirection ?? [0.577, 0.577, 0.577];
    this.sunColor = options.sunColor ?? [1.0, 0.97, 0.82];
    this.sunAngularSize = options.sunAngularSize ?? 3.0;
    this.sunGlowSize = options.sunGlowSize ?? 16.0;
    this.sunGlowIntensity = options.sunGlowIntensity ?? 0.25;
    this.worldUp = options.worldUp ?? [0, 0, 1];
  }

  /**
   * Allocates GL resources and compiles shaders.
   *
   * Safe to call more than once; subsequent calls are no-ops after successful initialization.
   */
  init(): SDKResult<void> {
    if (this.destroyed) {
      return {ok: false, type: SDKErrorType.InitializationFailed, error: "[SkyRenderer] Renderer has been destroyed"};
    }
    if (this.initialized) return {ok: true, value: undefined};

    try {
      const gl = this.gl;
      this.program = this.createProgram(VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);

      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      if (!vao || !vbo) throw new Error("[SkyRenderer] Failed to allocate WebGL resources");

      this.vao = vao;
      this.vbo = vbo;

      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      this.uInvViewProj = this.getUniformLocation("uInvViewProj");
      this.uCameraPos = this.getUniformLocation("uCameraPos");
      this.uWorldUp = this.getUniformLocation("uWorldUp");
      this.uSkyColor = this.getUniformLocation("uSkyColor");
      this.uHorizonColor = this.getUniformLocation("uHorizonColor");
      this.uGroundColor = this.getUniformLocation("uGroundColor");
      this.uHorizonBlend = this.getUniformLocation("uHorizonBlend");
      this.uSunEnabled = this.getUniformLocation("uSunEnabled");
      this.uSunDirection = this.getUniformLocation("uSunDirection");
      this.uSunColor = this.getUniformLocation("uSunColor");
      this.uSunCosSize = this.getUniformLocation("uSunCosSize");
      this.uSunGlowSize = this.getUniformLocation("uSunGlowSize");
      this.uSunGlowIntensity = this.getUniformLocation("uSunGlowIntensity");

      this.initialized = true;
      return {ok: true, value: undefined};
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: e instanceof Error ? e.message : String(e)
      };
    }
  }

  /**
   * Renders one frame of the sky for the given view.
   *
   * Called by {@link RenderManager} when {@link enabled} is true, before scene geometry.
   */
  render(viewRenderState: ViewRenderState): void {
    this.ensureReady();

    const view = viewRenderState.view;
    const camera = view.camera;

    // Per-view sky config — `view.effects.sky` is where user-facing
    // setters live (and where SunStudy writes when its `driveSky`
    // option is on). The SkyRenderer's own instance fields stay as
    // fallback defaults for views that don't carry an `effects.sky`
    // (e.g. unit tests or downstream consumers using the renderer
    // outside the Viewer pipeline).
    const cfg = (view as any).effects?.sky as {
      applied: boolean;
      enabled: boolean;
      skyColor: [number, number, number];
      horizonColor: [number, number, number];
      groundColor: [number, number, number];
      horizonBlend: number;
      sunEnabled: boolean;
      sunDirection: [number, number, number];
      sunColor: [number, number, number];
      sunAngularSize: number;
      sunGlowSize: number;
      sunGlowIntensity: number;
      worldUp: [number, number, number];
    } | undefined;

    // Gate on `applied` so the renderModes list takes effect alongside
    // the existing `enabled` flag. `applied` returns false when either
    // is false, so this is a strict superset of the prior check.
    if (cfg && cfg.applied === false) return;

    const skyColor         = cfg ? cfg.skyColor         : this.skyColor;
    const horizonColor     = cfg ? cfg.horizonColor     : this.horizonColor;
    const groundColor      = cfg ? cfg.groundColor      : this.groundColor;
    const horizonBlend     = cfg ? cfg.horizonBlend     : this.horizonBlend;
    const sunEnabled       = cfg ? cfg.sunEnabled       : this.sunEnabled;
    const sunDir           = cfg ? cfg.sunDirection     : this.sunDirection;
    const sunColor         = cfg ? cfg.sunColor         : this.sunColor;
    const sunAngularSize   = cfg ? cfg.sunAngularSize   : this.sunAngularSize;
    const sunGlowSize      = cfg ? cfg.sunGlowSize      : this.sunGlowSize;
    const sunGlowIntensity = cfg ? cfg.sunGlowIntensity : this.sunGlowIntensity;
    const worldUp          = cfg ? cfg.worldUp          : this.worldUp;

    // RTE: strip the view matrix translation so the inverse carries no large values.
    // Sky rendering only needs view direction, not position — the translation column
    // of the view matrix contributes nothing useful but causes float32 precision loss
    // in the inverse, producing jittery ray directions for distant cameras.
    const vm = this._rteViewMatrix;
    const src = camera.viewMatrix;
    for (let i = 0; i < 16; i++) vm[i] = src[i];
    vm[12] = 0; vm[13] = 0; vm[14] = 0;
    mulMat4(camera.projMatrix, vm, this.viewProjMatrix);
    inverseMat4(this.viewProjMatrix, this.invViewProjMatrix);

    const sdLen = Math.sqrt(sunDir[0] * sunDir[0] + sunDir[1] * sunDir[1] + sunDir[2] * sunDir[2]) || 1;
    const sunCosSize = Math.cos(sunAngularSize * (Math.PI / 180) * 0.5);

    const gl = this.gl;

    const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
    const prevVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
    const depthTestWasEnabled = gl.isEnabled(gl.DEPTH_TEST);
    const cullWasEnabled = gl.isEnabled(gl.CULL_FACE);
    const prevDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;

    // Sky is background: no depth test, no depth writes.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    this._invViewProjF32.set(this.invViewProjMatrix as ArrayLike<number>);
    gl.uniformMatrix4fv(this.uInvViewProj, false, this._invViewProjF32);
    gl.uniform3f(this.uCameraPos, 0, 0, 0); // RTE: camera is at origin in this coordinate frame
    gl.uniform3f(this.uWorldUp, worldUp[0], worldUp[1], worldUp[2]);
    gl.uniform3f(this.uSkyColor, skyColor[0], skyColor[1], skyColor[2]);
    gl.uniform3f(this.uHorizonColor, horizonColor[0], horizonColor[1], horizonColor[2]);
    gl.uniform3f(this.uGroundColor, groundColor[0], groundColor[1], groundColor[2]);
    gl.uniform1f(this.uHorizonBlend, horizonBlend);
    gl.uniform1i(this.uSunEnabled, sunEnabled ? 1 : 0);
    gl.uniform3f(this.uSunDirection, sunDir[0] / sdLen, sunDir[1] / sdLen, sunDir[2] / sdLen);
    gl.uniform3f(this.uSunColor, sunColor[0], sunColor[1], sunColor[2]);
    gl.uniform1f(this.uSunCosSize, sunCosSize);
    gl.uniform1f(this.uSunGlowSize, sunGlowSize);
    gl.uniform1f(this.uSunGlowIntensity, sunGlowIntensity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.depthMask(prevDepthMask);
    if (depthTestWasEnabled) gl.enable(gl.DEPTH_TEST);
    if (cullWasEnabled) gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(prevVAO);
    gl.useProgram(prevProgram);
  }

  /**
   * Frees all GL resources owned by this renderer. Safe to call more than once.
   */
  destroy(): void {
    if (this.destroyed) return;
    const gl = this.gl;
    if (this.vbo) { gl.deleteBuffer(this.vbo); this.vbo = null; }
    if (this.vao) { gl.deleteVertexArray(this.vao); this.vao = null; }
    if (this.program) { gl.deleteProgram(this.program); this.program = null; }
    this.uInvViewProj = null;
    this.uCameraPos = null;
    this.uWorldUp = null;
    this.uSkyColor = null;
    this.uHorizonColor = null;
    this.uGroundColor = null;
    this.uHorizonBlend = null;
    this.uSunEnabled = null;
    this.uSunDirection = null;
    this.uSunColor = null;
    this.uSunCosSize = null;
    this.uSunGlowSize = null;
    this.uSunGlowIntensity = null;
    this.initialized = false;
    this.destroyed = true;
  }

  private ensureNotDestroyed(): void {
    if (this.destroyed) throw new Error("[SkyRenderer] Renderer has been destroyed");
  }

  private ensureReady(): void {
    this.ensureNotDestroyed();
    if (!this.initialized || !this.program || !this.vao) {
      throw new Error("[SkyRenderer] Renderer not initialized — call init() first");
    }
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error("[SkyRenderer] Failed to create WebGL program");
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || "Program link failed";
      gl.deleteProgram(program);
      throw new Error(`[SkyRenderer] ${info}`);
    }
    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("[SkyRenderer] Failed to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || "Shader compile failed";
      gl.deleteShader(shader);
      throw new Error(`[SkyRenderer] ${info}`);
    }
    return shader;
  }

  private getUniformLocation(name: string): WebGLUniformLocation {
    if (!this.program) throw new Error("[SkyRenderer] Program not initialized");
    const loc = this.gl.getUniformLocation(this.program, name);
    if (loc === null) throw new Error(`[SkyRenderer] Uniform not found: ${name}`);
    return loc;
  }
}

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;

uniform mat4 uInvViewProj;
uniform vec3 uCameraPos;

out vec3 vRayDir;

void main() {
  // Unproject a point on the far plane to get the world-space ray direction.
  vec4 world = uInvViewProj * vec4(aPosition, 1.0, 1.0);
  vRayDir = (world.xyz / world.w) - uCameraPos;

  // Fullscreen quad; depth is irrelevant (depth test disabled by caller).
  gl_Position = vec4(aPosition, 1.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec3 vRayDir;
out vec4 outColor;

uniform vec3 uWorldUp;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uGroundColor;
uniform float uHorizonBlend;

uniform int uSunEnabled;
uniform vec3 uSunDirection;   // pre-normalized on CPU
uniform vec3 uSunColor;
uniform float uSunCosSize;    // cos(angularRadius)
uniform float uSunGlowSize;   // falloff exponent
uniform float uSunGlowIntensity;

uniform vec3 uCameraPos;      // unused in gradient but available for future use

void main() {
  vec3 dir = normalize(vRayDir);

  // Elevation: +1 at zenith, 0 at horizon, -1 at nadir.
  float elevation = dot(dir, uWorldUp);

  // Sky half (elevation > 0): exponential ramp from horizon to zenith.
  float blendInv = 1.0 / max(uHorizonBlend, 0.001);
  float skyT = 1.0 - exp(-max(elevation, 0.0) * blendInv * 3.0);

  // Ground half (elevation < 0): linear ramp controlled by horizonBlend.
  float groundT = clamp(-elevation * blendInv, 0.0, 1.0);

  vec3 color = uHorizonColor;
  color = mix(color, uSkyColor, skyT);
  color = mix(color, uGroundColor, groundT);

  if (uSunEnabled != 0) {
    // Sun disc: sharp edge with a thin antialiased ring.
    float cosA = dot(dir, uSunDirection);
    float discEdge = 0.0015; // ~half-pixel softening in cosine space
    float disc = smoothstep(uSunCosSize - discEdge, uSunCosSize + discEdge, cosA);

    // Radial glow: pow gives a compact halo that falls off quickly.
    float glow = pow(max(0.0, cosA), uSunGlowSize) * uSunGlowIntensity;

    // Horizon haze: brighten the horizon band in the direction of the sun.
    float horizonBand = 1.0 - smoothstep(0.0, uHorizonBlend * 2.5, abs(elevation));
    vec2 sunFloor = uSunDirection.xy; // floor-plane projection of sun dir
    vec2 dirFloor = dir.xy;
    float sunAzimuth = (length(sunFloor) > 0.001 && length(dirFloor) > 0.001)
      ? dot(normalize(dirFloor), normalize(sunFloor))
      : 0.0;
    float haze = horizonBand * max(0.0, sunAzimuth) * 0.18;

    color += uSunColor * (disc + glow + haze);
  }

  outColor = vec4(color, 1.0);
}
`;
