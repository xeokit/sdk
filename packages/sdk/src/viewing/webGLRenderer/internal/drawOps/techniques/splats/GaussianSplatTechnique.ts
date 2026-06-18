import type {ViewRenderState} from "../../../ViewRenderState";
import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import type {SplatBatch} from "../../../gpuMemoryManager/SplatBatch";
import {SplatSortWorker} from "../../../gpuMemoryManager/SplatSortWorker";
import {MAX_SECTION_PLANES, packSectionPlanes} from "../../DrawTechnique";

/** Reusable scratch for packing the active section planes each draw. */
const SECTION_PLANE_SCRATCH = new Float32Array(MAX_SECTION_PLANES * 4);

/** True if any of the 16 matrix elements differ (camera-moved test). */
function viewChanged(a: Float32Array, b: Float32Array): boolean {
  for (let i = 0; i < 16; i++) {
    if (a[i] !== b[i]) {
      return true;
    }
  }
  return false;
}

/*
 * 3D Gaussian Splatting draw pass — ports the validated standalone spike
 * (baked RGB, no SH) into the renderer. Self-contained GL pass hosted by
 * RenderManager: init() / render(viewRenderState, splatBatch) / destroy(),
 * GL state saved+restored.
 *
 * Conventions are LOCKED from the spike: covariance Σ = Mᵀ·M (done at pack time
 * in packSplats), and the EWA focal-Y sign is +1 here (see FOCAL_Y_SIGN). If the
 * in-browser result is upside-down / smeared, FOCAL_Y_SIGN is the first value to
 * flip (the SDK camera's projMatrix Y convention may differ from the spike's).
 *
 * The whole batch is drawn in ONE instanced call over a sorted item-index
 * buffer; the sort runs off the main thread (see SplatSortWorker).
 *
 * NOT unit-testable (owns a live GL program) — verify in the browser.
 */
const FOCAL_Y_SIGN = 1.0;

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uTex;     // RGBA32F, 4 texels/splat
uniform int uTexW;
uniform mat4 uView;
uniform mat4 uProj;
uniform vec2 uFocal;
uniform vec2 uViewport;

// Section-plane bank — plane equation packed as (normal.xyz, d), with
// dot(normal, worldPos) + d > 0 meaning "clipped side". t0.xyz is the splat's
// world-space centre, so the whole splat is culled per-centre (see comment in
// main). Compiled with a fixed array size; the renderer just updates the count.
uniform vec4 uSectionPlanes[${MAX_SECTION_PLANES}];
uniform int uSectionPlaneCount;

in vec2 aCorner;            // quad corner [-2, 2]
in uint aIndex;             // sorted splat item-index

out vec4 vColor;
out vec2 vCorner;

vec4 fetchTexel(int i) {
    int idx = int(aIndex) * 4 + i;
    return texelFetch(uTex, ivec2(idx % uTexW, idx / uTexW), 0);
}

void main() {
    vec4 t0 = fetchTexel(0);
    vec4 t1 = fetchTexel(1);
    vec4 t2 = fetchTexel(2);
    vec4 t3 = fetchTexel(3);

    vColor = vec4(t1.rgb, t0.w);

    // Section-plane clipping, per splat centre in world space. Cull the whole
    // splat off-screen when its centre is on the clipped side of any active
    // plane. Centre-granularity (the soft footprint can bleed ~one radius past
    // the cut); a per-fragment clean cut would need 3D ray/gaussian work.
    for (int i = 0; i < uSectionPlaneCount; i++) {
        if (dot(uSectionPlanes[i].xyz, t0.xyz) + uSectionPlanes[i].w > 0.0) {
            gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
            return;
        }
    }

    vec4 cam = uView * vec4(t0.xyz, 1.0);
    if (cam.z > -0.01) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);   // behind the camera: cull off-screen
        return;
    }

    mat3 Vrk = mat3(t2.x, t2.y, t2.z,
                    t2.y, t3.x, t3.y,
                    t2.z, t3.y, t3.z);
    float z = cam.z;
    mat3 J = mat3(uFocal.x / z, 0.0, -(uFocal.x * cam.x) / (z * z),
                  0.0, ${FOCAL_Y_SIGN.toFixed(1)} * uFocal.y / z, ${(-FOCAL_Y_SIGN).toFixed(1)} * (uFocal.y * cam.y) / (z * z),
                  0.0, 0.0, 0.0);
    mat3 W = transpose(mat3(uView));
    mat3 T = W * J;
    mat3 cov2d = transpose(T) * Vrk * T;

    float a = cov2d[0][0] + 0.3;
    float b = cov2d[0][1];
    float c = cov2d[1][1] + 0.3;
    float mid = 0.5 * (a + c);
    float radius = length(vec2(0.5 * (a - c), b));
    float l1 = mid + radius;
    float l2 = mid - radius;
    if (l2 <= 0.0) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);   // degenerate footprint: cull
        return;
    }

    vec2 e1 = normalize(vec2(b, l1 - a));
    vec2 e2 = vec2(e1.y, -e1.x);
    vec2 major = min(sqrt(2.0 * l1), 1024.0) * e1;
    vec2 minor = min(sqrt(2.0 * l2), 1024.0) * e2;

    vec4 clip = uProj * cam;
    vec2 off = (aCorner.x * major + aCorner.y * minor) / uViewport * 2.0 * clip.w;
    gl_Position = vec4(clip.xy + off, clip.zw);
    vCorner = aCorner;
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec4 vColor;
in vec2 vCorner;
out vec4 outColor;

void main() {
    float alpha = exp(-dot(vCorner, vCorner)) * vColor.a;
    if (alpha < 0.004) {
        discard;
    }
    outColor = vec4(vColor.rgb * alpha, alpha);   // premultiplied for blendFunc(ONE, 1 - SRC_A)
}
`;

/** Billboard quad corners, expanded by the EWA footprint in the vertex shader. */
const QUAD_CORNERS = new Float32Array([-2, -2, 2, -2, -2, 2, 2, 2]);

export class GaussianSplatTechnique {

  private readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private cornerBuf: WebGLBuffer | null = null;
  private idxBuf: WebGLBuffer | null = null;
  private aCorner = -1;
  private aIndex = -1;
  private uTex: WebGLUniformLocation | null = null;
  private uTexW: WebGLUniformLocation | null = null;
  private uView: WebGLUniformLocation | null = null;
  private uProj: WebGLUniformLocation | null = null;
  private uFocal: WebGLUniformLocation | null = null;
  private uViewport: WebGLUniformLocation | null = null;
  private uSectionPlanes: WebGLUniformLocation | null = null;
  private uSectionPlaneCount: WebGLUniformLocation | null = null;
  private initialized = false;
  private destroyed = false;

  private _sortWorker: SplatSortWorker | null = null;
  private _revision = -1;
  private _count = 0;
  private _fallbackIdx = new Uint32Array(0);     // unsorted order, until first sort lands
  private _uploaded: Uint32Array | null = null;  // what's currently in idxBuf
  private _lastView: Float32Array | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  init(): SDKResult<void> {
    if (this.initialized) {
      return {ok: true, value: undefined};
    }
    try {
      const gl = this.gl;
      this.program = this.createProgram(VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
      this.cornerBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuf);
      gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
      this.idxBuf = gl.createBuffer();
      this._sortWorker = new SplatSortWorker();
      this.aCorner = gl.getAttribLocation(this.program, "aCorner");
      this.aIndex = gl.getAttribLocation(this.program, "aIndex");
      this.uTex = this.getUniformLocation("uTex");
      this.uTexW = this.getUniformLocation("uTexW");
      this.uView = this.getUniformLocation("uView");
      this.uProj = this.getUniformLocation("uProj");
      this.uFocal = this.getUniformLocation("uFocal");
      this.uViewport = this.getUniformLocation("uViewport");
      this.uSectionPlanes = this.getUniformLocation("uSectionPlanes[0]");
      this.uSectionPlaneCount = this.getUniformLocation("uSectionPlaneCount");
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      this.initialized = true;
      return {ok: true, value: undefined};
    } catch (e) {
      this.destroy();
      return {ok: false, type: SDKErrorType.InitializationFailed, error: e instanceof Error ? e.message : String(e)};
    }
  }

  render(viewRenderState: ViewRenderState, splatBatch: SplatBatch | null): void {
    if (!this.initialized || !this.program || !splatBatch || splatBatch.numSplats === 0) {
      return;
    }
    const gl = this.gl;
    const camera = viewRenderState.view.camera;
    const view = camera.viewMatrix as unknown as Float32Array;
    const proj = camera.projMatrix as unknown as Float32Array;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;

    // Flush any newly-added/removed splat portions to the GPU texture.
    splatBatch.uploadChanges();

    // Re-feed the sort worker whenever the splat set changes.
    if (splatBatch.revision !== this._revision) {
      this._revision = splatBatch.revision;
      const {positions, itemIndices} = this._extractCentres(splatBatch);
      this._count = itemIndices.length;
      this._fallbackIdx = itemIndices;   // unsorted order until the first sort lands
      this._uploaded = null;
      this._lastView = null;
      this._sortWorker?.setPositions(positions, itemIndices);
    }
    if (this._count === 0) {
      return;
    }

    // Request a fresh sort when the camera has moved.
    if (!this._lastView || viewChanged(view, this._lastView)) {
      this._sortWorker?.requestSort(view);
      this._lastView = view.slice() as Float32Array;
    }

    // Draw the latest sorted order (or the unsorted fallback until the first
    // async result arrives). Re-upload only when the order actually changes.
    const order = this._sortWorker?.latest ?? this._fallbackIdx;
    if (order !== this._uploaded) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.idxBuf);
      gl.bufferData(gl.ARRAY_BUFFER, order, gl.DYNAMIC_DRAW);
      this._uploaded = order;
    }

    // Save GL state we touch.
    const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
    const blendOn = gl.isEnabled(gl.BLEND);
    const cullOn = gl.isEnabled(gl.CULL_FACE);
    const depthMask = gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;

    gl.useProgram(this.program);
    // Focal length in pixels, from the camera's own projection.
    const fx = proj[0] * w * 0.5;
    const fy = proj[5] * h * 0.5;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, splatBatch.texture.texture);
    gl.uniform1i(this.uTex, 0);
    gl.uniform1i(this.uTexW, splatBatch.texture.width);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniformMatrix4fv(this.uProj, false, proj);
    gl.uniform2f(this.uFocal, fx, fy);
    gl.uniform2f(this.uViewport, w, h);

    // Section planes (world space) — culls clipped splats per centre in the VS.
    const planeCount = packSectionPlanes(viewRenderState.view.sectionPlanesList, SECTION_PLANE_SCRATCH);
    gl.uniform1i(this.uSectionPlaneCount, planeCount);
    if (planeCount > 0) {
      gl.uniform4fv(this.uSectionPlanes, SECTION_PLANE_SCRATCH);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuf);
    gl.enableVertexAttribArray(this.aCorner);
    gl.vertexAttribPointer(this.aCorner, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.aCorner, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.idxBuf);
    gl.enableVertexAttribArray(this.aIndex);
    gl.vertexAttribIPointer(this.aIndex, 1, gl.UNSIGNED_INT, 0, 0);
    gl.vertexAttribDivisor(this.aIndex, 1);

    // Splats depth-test against opaque geometry but don't write depth, and
    // blend back-to-front with premultiplied "over".
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // One instanced draw for the whole batch.
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this._count);

    // Restore.
    gl.vertexAttribDivisor(this.aIndex, 0);
    gl.depthMask(depthMask);
    if (!blendOn) {
      gl.disable(gl.BLEND);
    }
    if (cullOn) {
      gl.enable(gl.CULL_FACE);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(prevProgram);
  }

  /**
   * Extracts live splat centres (compact, world-space) + their texture
   * item-indices from the batch texture's CPU buffer, for the sort worker.
   */
  private _extractCentres(splatBatch: SplatBatch): {positions: Float32Array; itemIndices: Uint32Array} {
    const buf = splatBatch.texture.buffer as Float32Array;
    const epi = splatBatch.texture.elementsPerItem; // 16
    const n = splatBatch.numSplats;
    const positions = new Float32Array(n * 3);
    const itemIndices = new Uint32Array(n);
    let k = 0;
    for (const p of splatBatch.portions) {
      for (let i = 0; i < p.count; i++) {
        const item = p.base + i;
        const o = item * epi;
        positions[k * 3] = buf[o];
        positions[k * 3 + 1] = buf[o + 1];
        positions[k * 3 + 2] = buf[o + 2];
        itemIndices[k] = item;
        k++;
      }
    }
    return {positions, itemIndices};
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    const gl = this.gl;
    this._sortWorker?.destroy();
    this._sortWorker = null;
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    if (this.cornerBuf) {
      gl.deleteBuffer(this.cornerBuf);
    }
    if (this.idxBuf) {
      gl.deleteBuffer(this.idxBuf);
    }
    this.program = null;
    this.cornerBuf = null;
    this.idxBuf = null;
    this.destroyed = true;
    this.initialized = false;
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error("[GaussianSplatTechnique] Failed to create WebGL program");
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || "Program link failed";
      gl.deleteProgram(program);
      throw new Error(`[GaussianSplatTechnique] ${info}`);
    }
    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("[GaussianSplatTechnique] Failed to create shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || "Shader compile failed";
      gl.deleteShader(shader);
      throw new Error(`[GaussianSplatTechnique] ${info}`);
    }
    return shader;
  }

  private getUniformLocation(name: string): WebGLUniformLocation {
    const location = this.gl.getUniformLocation(this.program!, name);
    if (location === null) {
      throw new Error(`[GaussianSplatTechnique] Uniform not found: ${name}`);
    }
    return location;
  }
}
