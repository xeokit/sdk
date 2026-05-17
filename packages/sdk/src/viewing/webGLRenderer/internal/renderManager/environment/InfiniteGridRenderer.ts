import {
  createMat4Float64,
  mulMat4,
  type Mat4
} from "../../../../../base/math/matrix";
import type {ViewRenderState} from "../../ViewRenderState";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";

export interface InfiniteGridRendererOptions {
  /**
   * World-space spacing for minor grid lines.
   */
  minorStep?: number;

  /**
   * World-space spacing for major grid lines.
   */
  majorStep?: number;

  /**
   * Axis line width as a multiplier of minorStep when not overridden per-frame.
   */
  axisWidth?: number;

  /**
   * Distance from camera XZ position at which grid fading begins.
   */
  fadeStart?: number;

  /**
   * Distance from camera XZ position at which grid is fully faded out.
   */
  fadeEnd?: number;

  /**
   * Half-size of the camera-centered quad in world units.
   */
  gridHalfSize?: number;

  /**
   * Whether the quad should follow the attached camera in XZ.
   */
  followCamera?: boolean;

  /**
   * Minor line color.
   */
  minorColor?: [number, number, number];

  /**
   * Major line color.
   */
  majorColor?: [number, number, number];

  /**
   * X-axis color.
   */
  xAxisColor?: [number, number, number];

  /**
   * Z-axis color.
   */
  zAxisColor?: [number, number, number];

  /**
   * World-space "up" direction. Defaults to Z-up `[0,0,1]` to match the Scene default.
   */
  worldUp?: [number, number, number];

  /**
   * World-space "right" direction (first floor-plane axis). Defaults to `[1,0,0]`.
   */
  worldRight?: [number, number, number];

  /**
   * World-space "forward" direction (second floor-plane axis). Defaults to `[0,1,0]`.
   */
  worldForward?: [number, number, number];
}


/**
 * Infinite ground grid renderer for xeokit V3.
 *
 * Integrated into {@link RenderManager} and rendered once per frame via
 * `render(viewRenderState)` when {@link enabled} is true.
 *
 * Features:
 * - Draws a flat grid on world plane y = 0
 * - Uses one camera-centered quad
 * - Minor/major lines and world axes generated in the fragment shader
 * - Derivative-based antialiasing with `fwidth`
 * - Accepts an externally managed WebGL2RenderingContext
 *
 * Notes:
 * - Does not manage framebuffers, viewport, clearing, or camera updates
 * - Call `init()` once, then `render(viewRenderState)` each frame when enabled
 * - Preserves/restores the GL state it changes internally
 *
 * ```ts
 * const grid = renderManager.infiniteGrid;
 * grid.enabled = true;
 * grid.minorStep = 1;
 * grid.majorStep = 10;
 * ```
 */
export class InfiniteGridRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly viewProjMatrix: Mat4 = createMat4Float64();
  private readonly _rteViewMatrix: Mat4 = createMat4Float64();

  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  private uViewProj: WebGLUniformLocation | null = null;
  private uGridCenter: WebGLUniformLocation | null = null;
  private uGridHalfSize: WebGLUniformLocation | null = null;
  private uCameraPos: WebGLUniformLocation | null = null;
  private uMinorStep: WebGLUniformLocation | null = null;
  private uMajorStep: WebGLUniformLocation | null = null;
  private uAxisWidth: WebGLUniformLocation | null = null;
  private uFadeStart: WebGLUniformLocation | null = null;
  private uFadeEnd: WebGLUniformLocation | null = null;
  private uMinorColor: WebGLUniformLocation | null = null;
  private uMajorColor: WebGLUniformLocation | null = null;
  private uXAxisColor: WebGLUniformLocation | null = null;
  private uZAxisColor: WebGLUniformLocation | null = null;
  private uWorldRight: WebGLUniformLocation | null = null;
  private uWorldForward: WebGLUniformLocation | null = null;

  /**
   * When true, {@link RenderManager} will render this grid each frame.
   */
  public enabled: boolean = false;

  /**
   * Default spacing for minor grid lines.
   */
  public minorStep: number;

  /**
   * Default spacing for major grid lines.
   */
  public majorStep: number;

  /**
   * Default axis width multiplier relative to minorStep.
   */
  public axisWidth: number;

  /**
   * Default fade start distance from camera in XZ.
   */
  public fadeStart: number;

  /**
   * Default fade end distance from camera in XZ.
   */
  public fadeEnd: number;

  /**
   * Default half-size of the rendered quad in world units.
   */
  public gridHalfSize: number;

  /**
   * When true, the quad is centered under the camera in XZ by default.
   */
  public followCamera: boolean;

  /**
   * Default minor grid color.
   */
  public minorColor: [number, number, number];

  /**
   * Default major grid color.
   */
  public majorColor: [number, number, number];

  /**
   * Default X-axis color.
   */
  public xAxisColor: [number, number, number];

  /**
   * Default Z-axis color.
   */
  public zAxisColor: [number, number, number];

  /**
   * World-space "up" direction. Matches the Scene's `CoordinateSystem.worldUp`.
   * Default is `[0,0,1]` (Z-up), matching the Scene default.
   */
  public worldUp: [number, number, number];

  /**
   * World-space "right" direction (first floor-plane axis).
   * Default is `[1,0,0]`, matching the Scene default.
   */
  public worldRight: [number, number, number];

  /**
   * World-space "forward" direction (second floor-plane axis).
   * Default is `[0,1,0]`, matching the Scene default.
   */
  public worldForward: [number, number, number];

  /**
   * True once init() has successfully allocated resources.
   */
  public initialized = false;

  /**
   * True once destroy() has been called.
   */
  public destroyed = false;

  constructor(gl: WebGL2RenderingContext, options: InfiniteGridRendererOptions = {}) {
    this.gl = gl;

    this.minorStep = options.minorStep ?? 1.0;
    this.majorStep = options.majorStep ?? 10.0;
    this.axisWidth = options.axisWidth ?? 0.06;
    this.fadeStart = options.fadeStart ?? 80.0;
    this.fadeEnd = options.fadeEnd ?? 500.0;
    this.gridHalfSize = options.gridHalfSize ?? 1000.0;
    this.followCamera = options.followCamera ?? true;
    this.minorColor = options.minorColor ?? [0.24, 0.27, 0.31];
    this.majorColor = options.majorColor ?? [0.42, 0.46, 0.52];
    this.xAxisColor = options.xAxisColor ?? [0.93, 0.36, 0.30];
    this.zAxisColor = options.zAxisColor ?? [0.33, 0.62, 0.96];
    this.worldUp = options.worldUp ?? [0, 0, 1];
    this.worldRight = options.worldRight ?? [1, 0, 0];
    this.worldForward = options.worldForward ?? [0, 1, 0];
  }

  /**
   * Allocates GL resources and compiles shaders.
   *
   * Safe to call more than once; subsequent calls are no-ops after successful initialization.
   */
  init(): SDKResult<void> {
    if (this.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[InfiniteGridRenderer] Renderer has been destroyed"
      };
    }
    if (this.initialized) {
      return {ok: true, value: undefined};
    }

    try {
      const gl = this.gl;

      this.program = this.createProgram(VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);

      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();

      if (!vao || !vbo) {
        throw new Error("[InfiniteGridRenderer] Failed to allocate WebGL resources");
      }

      this.vao = vao;
      this.vbo = vbo;

      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      this.uViewProj = this.getUniformLocation("uViewProj");
      this.uGridCenter = this.getUniformLocation("uGridCenter");
      this.uGridHalfSize = this.getUniformLocation("uGridHalfSize");
      this.uCameraPos = this.getUniformLocation("uCameraPos");
      this.uMinorStep = this.getUniformLocation("uMinorStep");
      this.uMajorStep = this.getUniformLocation("uMajorStep");
      this.uAxisWidth = this.getUniformLocation("uAxisWidth");
      this.uFadeStart = this.getUniformLocation("uFadeStart");
      this.uFadeEnd = this.getUniformLocation("uFadeEnd");
      this.uMinorColor = this.getUniformLocation("uMinorColor");
      this.uMajorColor = this.getUniformLocation("uMajorColor");
      this.uXAxisColor = this.getUniformLocation("uXAxisColor");
      this.uZAxisColor = this.getUniformLocation("uZAxisColor");
      this.uWorldRight = this.getUniformLocation("uWorldRight");
      this.uWorldForward = this.getUniformLocation("uWorldForward");

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
   * Renders one frame of the infinite grid for the given view.
   *
   * Called by {@link RenderManager} when {@link enabled} is true.
   */
  render(viewRenderState: ViewRenderState): void {
    this.ensureReady();

    const camera = viewRenderState.view.camera;
    const eye = camera.eye;

    // RTE: strip the view matrix translation so float32 GPU values stay small.
    // Large eye positions cause catastrophic cancellation when world coords are
    // multiplied by a viewProj that carries a large translation column.
    const vm = this._rteViewMatrix;
    const src = camera.viewMatrix;
    for (let i = 0; i < 16; i++) vm[i] = src[i];
    vm[12] = 0; vm[13] = 0; vm[14] = 0;
    mulMat4(camera.projMatrix, vm, this.viewProjMatrix);

    // Express grid center relative to the camera eye so vertex positions are small.
    const up = this.worldUp;
    const upDot = eye[0] * up[0] + eye[1] * up[1] + eye[2] * up[2];
    const gridCenter = this.followCamera
      ? [-up[0] * upDot, -up[1] * upDot, -up[2] * upDot]   // camera-relative floor projection ≈ [0,0,0] for typical heights
      : [-eye[0], -eye[1], -eye[2]];                         // world origin relative to camera

    const axisWidth = this.minorStep * this.axisWidth;

    const gl = this.gl;

    // Preserve a small set of GL state we modify internally.
    const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
    const prevVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
    const blendWasEnabled = gl.isEnabled(gl.BLEND);
    const cullWasEnabled = gl.isEnabled(gl.CULL_FACE);
    const depthMask = gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // The grid is translucent and should not write depth.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);

    gl.uniformMatrix4fv(this.uViewProj, false, new Float32Array(this.viewProjMatrix as Float32List)); // TODO: avoid this allocation each frame
    gl.uniform3f(this.uGridCenter, gridCenter[0], gridCenter[1], gridCenter[2]);
    gl.uniform1f(this.uGridHalfSize, this.gridHalfSize);
    gl.uniform3f(this.uCameraPos, 0, 0, 0); // RTE: camera is at origin in this coordinate frame
    gl.uniform1f(this.uMinorStep, this.minorStep);
    gl.uniform1f(this.uMajorStep, this.majorStep);
    gl.uniform1f(this.uAxisWidth, axisWidth);
    gl.uniform1f(this.uFadeStart, this.fadeStart);
    gl.uniform1f(this.uFadeEnd, this.fadeEnd);
    gl.uniform3f(this.uMinorColor, this.minorColor[0], this.minorColor[1], this.minorColor[2]);
    gl.uniform3f(this.uMajorColor, this.majorColor[0], this.majorColor[1], this.majorColor[2]);
    gl.uniform3f(this.uXAxisColor, this.xAxisColor[0], this.xAxisColor[1], this.xAxisColor[2]);
    gl.uniform3f(this.uZAxisColor, this.zAxisColor[0], this.zAxisColor[1], this.zAxisColor[2]);
    gl.uniform3f(this.uWorldRight, this.worldRight[0], this.worldRight[1], this.worldRight[2]);
    gl.uniform3f(this.uWorldForward, this.worldForward[0], this.worldForward[1], this.worldForward[2]);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Restore GL state we changed.
    gl.depthMask(depthMask);
    if (!blendWasEnabled) {
      gl.disable(gl.BLEND);
    }
    if (cullWasEnabled) {
      gl.enable(gl.CULL_FACE);
    }
    gl.bindVertexArray(prevVAO);
    gl.useProgram(prevProgram);
  }

  /**
   * Frees all GL resources owned by this renderer.
   *
   * Safe to call more than once.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    const gl = this.gl;

    if (this.vbo) {
      gl.deleteBuffer(this.vbo);
      this.vbo = null;
    }

    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }

    this.uViewProj = null;
    this.uGridCenter = null;
    this.uGridHalfSize = null;
    this.uCameraPos = null;
    this.uMinorStep = null;
    this.uMajorStep = null;
    this.uAxisWidth = null;
    this.uFadeStart = null;
    this.uFadeEnd = null;
    this.uMinorColor = null;
    this.uMajorColor = null;
    this.uXAxisColor = null;
    this.uZAxisColor = null;
    this.uWorldRight = null;
    this.uWorldForward = null;

    this.initialized = false;
    this.destroyed = true;
  }

  private ensureNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error("[InfiniteGridRenderer] Renderer has been destroyed");
    }
  }

  private ensureReady(): void {
    this.ensureNotDestroyed();

    if (!this.initialized || !this.program || !this.vao) {
      throw new Error("[InfiniteGridRenderer] Renderer not initialized - call init() first");
    }
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error("[InfiniteGridRenderer] Failed to create WebGL program");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || "Program link failed";
      gl.deleteProgram(program);
      throw new Error(`[InfiniteGridRenderer] ${info}`);
    }

    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("[InfiniteGridRenderer] Failed to create shader");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || "Shader compile failed";
      gl.deleteShader(shader);
      throw new Error(`[InfiniteGridRenderer] ${info}`);
    }

    return shader;
  }

  private getUniformLocation(name: string): WebGLUniformLocation {
    if (!this.program) {
      throw new Error("[InfiniteGridRenderer] Program not initialized");
    }

    const location = this.gl.getUniformLocation(this.program, name);
    if (location === null) {
      throw new Error(`[InfiniteGridRenderer] Uniform not found: ${name}`);
    }

    return location;
  }
}

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;

uniform mat4 uViewProj;
uniform vec3 uGridCenter;
uniform float uGridHalfSize;
uniform vec3 uWorldRight;
uniform vec3 uWorldForward;

out vec3 vWorldPos;

void main() {
  // Span the quad in the floor plane using the scene's right/forward axes.
  // uGridCenter is already projected to the floor (up-component zeroed on the CPU side).
  vec3 worldPos = uGridCenter
    + uWorldRight   * (aPosition.x * uGridHalfSize)
    + uWorldForward * (aPosition.y * uGridHalfSize);

  vWorldPos = worldPos;
  gl_Position = uViewProj * vec4(worldPos, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec3 vWorldPos;
out vec4 outColor;

uniform vec3 uCameraPos;
uniform float uMinorStep;
uniform float uMajorStep;
uniform float uAxisWidth;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform vec3 uMinorColor;
uniform vec3 uMajorColor;
uniform vec3 uXAxisColor;
uniform vec3 uZAxisColor;
uniform vec3 uWorldRight;
uniform vec3 uWorldForward;

// Returns a softened line intensity for a repeated coordinate.
float lineFactor(float coord, float stepSize) {
  float x = coord / stepSize;
  float fw = max(fwidth(x), 1e-6);
  float d = abs(fract(x - 0.5) - 0.5) / fw;
  return 1.0 - min(d, 1.0);
}

// 2D grid intensity from floor-plane coordinates.
float gridFactor(vec2 p, float stepSize) {
  float gx = lineFactor(p.x, stepSize);
  float gz = lineFactor(p.y, stepSize);
  return max(gx, gz);
}

// World-axis highlight with derivative-aware softening.
float axisFactor(float coord, float widthWorld) {
  float fw = max(fwidth(coord), 1e-6);
  float w = max(widthWorld, fw);
  float d = abs(coord) / w;
  return 1.0 - smoothstep(0.0, 1.0, d);
}

void main() {
  // Project world position onto the floor plane coordinate axes.
  vec2 p = vec2(dot(vWorldPos, uWorldRight), dot(vWorldPos, uWorldForward));

  float minor = gridFactor(p, uMinorStep);
  float major = gridFactor(p, uMajorStep);
  float axisX = axisFactor(p.x, uAxisWidth);
  float axisZ = axisFactor(p.y, uAxisWidth);

  vec3 color = vec3(0.0);
  color += uMinorColor * minor * 0.8;
  color += uMajorColor * major;
  color = mix(color, uXAxisColor, axisX);
  color = mix(color, uZAxisColor, axisZ);

  // Fade by distance from the camera within the floor plane.
  vec2 camFloor = vec2(dot(uCameraPos, uWorldRight), dot(uCameraPos, uWorldForward));
  float distFloor = distance(camFloor, p);
  float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, distFloor);

  float lineAlpha = max(max(minor * 0.55, major), max(axisX, axisZ));
  float alpha = lineAlpha * fade;

  if (alpha < 0.01) {
    discard;
  }

  outColor = vec4(color, alpha);
}
`;
