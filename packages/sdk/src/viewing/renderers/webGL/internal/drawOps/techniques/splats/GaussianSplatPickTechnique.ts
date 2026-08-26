import {SDKErrorType, type SDKResult} from "../../../../../../../base/core";
import type {SplatBatch} from "../../../gpuMemoryManager/SplatBatch";
import {MAX_SECTION_PLANES, packSectionPlanes, type SectionPlaneLike} from "../../DrawTechnique";

/** Reusable scratch for packing the active section planes each pick. */
const SECTION_PLANE_SCRATCH = new Float32Array(MAX_SECTION_PLANES * 4);

/**
 * Reserved pick-buffer `batchIndex` marking a splat hit. Chosen so the
 * opaque-background clear (alpha byte = 255) can't collide and real mesh
 * batch indices (small) never reach it. PickManager reads this back to know
 * the picked fragment is a splat rather than a mesh.
 */
export const SPLAT_PICK_SENTINEL = 0x00fffffe;

/** Gaussian weight × opacity below which a splat fragment isn't "surface". */
const PICK_ALPHA_THRESHOLD = 0.3;

/** EWA focal-Y sign — must match {@link GaussianSplatTechnique}. */
const FOCAL_Y_SIGN = 1.0;

/*
 * Pick pass for gaussian splats — the splat analogue of GenericPickMeshTechnique.
 *
 * Reuses the validated EWA projection from GaussianSplatTechnique, but renders
 * into the 1×1 pick framebuffer's 3 MRT targets (batchIndex / meshIndex / depth)
 * with depth-test + depth-write ON and blend OFF, so the NEAREST solid splat at
 * the cursor wins — and competes in the same depth buffer as mesh geometry, so
 * a wall in front of the splats occludes them (and vice-versa), exactly like
 * triangle picking.
 *
 * `remapPickClipPos` mirrors DrawTechnique's mesh-pick remap: the splat's
 * cursor-relative clip offset is scaled into the 1×1 pick viewport. Splats are
 * world-space baked, so the fragment writes view-space depth (centre z) which
 * PickManager unprojects straight through proj × view (no coord-system / RTC).
 *
 * The whole batch is drawn in ONE instanced call: each splat carries its owning
 * mesh's pick id in the texture (packed by packSplats), so no per-mesh uniform
 * or per-portion draw is needed. Unsorted — depth-test, not draw order, resolves
 * the nearest hit, so no sort worker is needed.
 *
 * NOT unit-testable (owns a live GL program) — verify in the browser.
 */
const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uTex;     // RGBA32F, 4 texels/splat
uniform int uTexW;
uniform mat4 uView;
uniform mat4 uProj;
uniform vec2 uFocal;
uniform vec2 uViewport;
uniform vec2 uPickClipPos;  // cursor in NDC [-1, 1]

// Section-plane bank — must match GaussianSplatTechnique so a clipped splat is
// unpickable, not just invisible. Plane equation packed as (normal.xyz, d).
uniform vec4 uSectionPlanes[${MAX_SECTION_PLANES}];
uniform int uSectionPlaneCount;

in vec2 aCorner;            // quad corner [-2, 2]
in uint aIndex;             // live splat item-index in the batch texture

flat out uint vMeshPickId;
flat out float vViewZ;
out vec4 vColor;
out vec2 vCorner;

vec4 fetchTexel(int i) {
    int idx = int(aIndex) * 4 + i;
    return texelFetch(uTex, ivec2(idx % uTexW, idx / uTexW), 0);
}

// Shift the splat's clip position so the cursor neighbourhood lands in the
// 1×1 pick viewport (mirrors DrawTechnique's mesh-pick remapPickClipPos).
vec4 remapPickClipPos(vec4 clipPos) {
    clipPos.xy /= clipPos.w;
    clipPos.xy = (clipPos.xy - uPickClipPos) * uViewport;
    clipPos.xy *= clipPos.w;
    return clipPos;
}

void main() {
    vec4 t0 = fetchTexel(0);
    vec4 t1 = fetchTexel(1);
    vec4 t2 = fetchTexel(2);
    vec4 t3 = fetchTexel(3);

    vColor = vec4(t1.rgb, t0.w);
    vMeshPickId = uint(t1.w + 0.5);

    // Section-plane clipping, per splat centre (world space) — identical to the
    // colour pass so picking and rendering agree. Cull off-screen before the
    // fragment shader can write any pick MRT.
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
    vViewZ = cam.z;

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
    gl_Position = remapPickClipPos(vec4(clip.xy + off, clip.zw));
    vCorner = aCorner;
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
precision highp int;

flat in uint vMeshPickId;
flat in float vViewZ;
in vec4 vColor;
in vec2 vCorner;

uniform float uPickZNear;
uniform float uPickZFar;

layout(location = 0) out vec4 outBatchIndex;
layout(location = 1) out vec4 outMeshIndex;
layout(location = 2) out vec4 outDepth;

// Packs a 32-bit uint into 4 normalized 8-bit channels (R = least-significant).
vec4 packUintToRGBA8(uint v) {
    return vec4(
        float( v         & 0xFFu),
        float((v >> 8u)  & 0xFFu),
        float((v >> 16u) & 0xFFu),
        float((v >> 24u) & 0xFFu)
    ) / 255.0;
}

// Packs a normalized [0,1] depth into RGBA8.
vec4 packDepth(const in float depth) {
    const vec4 bitShift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bitMask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
    vec4 res = fract(depth * bitShift);
    res -= res.xxyz * bitMask;
    return res;
}

void main() {
    float alpha = exp(-dot(vCorner, vCorner)) * vColor.a;
    if (alpha < ${PICK_ALPHA_THRESHOLD.toFixed(3)}) {
        discard;   // pick the solid core, not the faint fringe
    }
    outBatchIndex = packUintToRGBA8(${SPLAT_PICK_SENTINEL}u);
    outMeshIndex = packUintToRGBA8(vMeshPickId);
    float zNormalized = abs((uPickZNear + vViewZ) / (uPickZFar - uPickZNear));
    outDepth = packDepth(zNormalized);
}
`;

/** Billboard quad corners, expanded by the EWA footprint in the vertex shader. */
const QUAD_CORNERS = new Float32Array([-2, -2, 2, -2, -2, 2, 2, 2]);

export class GaussianSplatPickTechnique {

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
  private uPickClipPos: WebGLUniformLocation | null = null;
  private uPickZNear: WebGLUniformLocation | null = null;
  private uPickZFar: WebGLUniformLocation | null = null;
  private uSectionPlanes: WebGLUniformLocation | null = null;
  private uSectionPlaneCount: WebGLUniformLocation | null = null;
  private initialized = false;

  private _revision = -1;   // batch revision the idxBuf was built for
  private _count = 0;       // live splats in the idxBuf
  private readonly _view = new Float32Array(16);
  private readonly _proj = new Float32Array(16);

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
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      this.idxBuf = gl.createBuffer();
      this.aCorner = gl.getAttribLocation(this.program, "aCorner");
      this.aIndex = gl.getAttribLocation(this.program, "aIndex");
      this.uTex = this.getUniformLocation("uTex");
      this.uTexW = this.getUniformLocation("uTexW");
      this.uView = this.getUniformLocation("uView");
      this.uProj = this.getUniformLocation("uProj");
      this.uFocal = this.getUniformLocation("uFocal");
      this.uViewport = this.getUniformLocation("uViewport");
      this.uPickClipPos = this.getUniformLocation("uPickClipPos");
      this.uPickZNear = this.getUniformLocation("uPickZNear");
      this.uPickZFar = this.getUniformLocation("uPickZFar");
      this.uSectionPlanes = this.getUniformLocation("uSectionPlanes[0]");
      this.uSectionPlaneCount = this.getUniformLocation("uSectionPlaneCount");
      this.initialized = true;
      return {ok: true, value: undefined};
    } catch (e) {
      this.destroy();
      return {ok: false, type: SDKErrorType.InitializationFailed, error: e instanceof Error ? e.message : String(e)};
    }
  }

  /**
   * Draws the whole splat batch into the currently-bound pick framebuffer (1×1
   * viewport already set by PickManager) in a single instanced call. `view`/
   * `proj` are the pick view + projection matrices; `pickClipPos` is the cursor
   * in NDC; `pickZNear`/`pickZFar` the pick depth range.
   */
  drawPick(opts: {
    view: ArrayLike<number>;
    proj: ArrayLike<number>;
    viewportWidth: number;
    viewportHeight: number;
    pickClipPos: number[];
    pickZNear: number;
    pickZFar: number;
    splatBatch: SplatBatch;
    sectionPlanes?: ReadonlyArray<SectionPlaneLike>;
  }): void {
    if (!this.initialized || !this.program) {
      return;
    }
    const splatBatch = opts.splatBatch;
    if (!splatBatch || splatBatch.numSplats === 0) {
      return;
    }

    const gl = this.gl;
    const w = opts.viewportWidth;
    const h = opts.viewportHeight;

    // A pick can fire before the next render frame uploads the batch — flush
    // any pending portion changes so the texture is current.
    splatBatch.uploadChanges();

    // Rebuild the (unsorted) item-index buffer when the splat set changes;
    // depth-test, not draw order, resolves the nearest hit, so no sort needed.
    if (splatBatch.revision !== this._revision) {
      this._revision = splatBatch.revision;
      const indices = this._buildIndices(splatBatch);
      this._count = indices.length;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.idxBuf);
      gl.bufferData(gl.ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    if (this._count === 0) {
      return;
    }

    this._view.set(opts.view);
    this._proj.set(opts.proj);

    gl.useProgram(this.program);

    // Focal length in pixels, from the pick projection.
    const fx = this._proj[0] * w * 0.5;
    const fy = this._proj[5] * h * 0.5;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, splatBatch.texture.texture);
    gl.uniform1i(this.uTex, 0);
    gl.uniform1i(this.uTexW, splatBatch.texture.width);
    gl.uniformMatrix4fv(this.uView, false, this._view);
    gl.uniformMatrix4fv(this.uProj, false, this._proj);
    gl.uniform2f(this.uFocal, fx, fy);
    gl.uniform2f(this.uViewport, w, h);
    gl.uniform2f(this.uPickClipPos, opts.pickClipPos[0], opts.pickClipPos[1]);
    gl.uniform1f(this.uPickZNear, opts.pickZNear);
    gl.uniform1f(this.uPickZFar, opts.pickZFar);

    // Section planes — must match the colour pass so a clipped splat is unpickable.
    const planeCount = packSectionPlanes(opts.sectionPlanes, SECTION_PLANE_SCRATCH);
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

    // Solid pick: nearest splat wins, sharing depth with mesh geometry.
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    // One instanced draw for the whole batch.
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this._count);

    gl.vertexAttribDivisor(this.aIndex, 0);
    gl.disableVertexAttribArray(this.aCorner);
    gl.disableVertexAttribArray(this.aIndex);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** All live splat item-indices across the batch's portions, for the draw. */
  private _buildIndices(splatBatch: SplatBatch): Uint32Array {
    const indices = new Uint32Array(splatBatch.numSplats);
    let k = 0;
    for (const portion of splatBatch.portions) {
      for (let i = 0; i < portion.count; i++) {
        indices[k++] = portion.base + i;
      }
    }
    return indices;
  }

  destroy(): void {
    const gl = this.gl;
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
      throw new Error("[GaussianSplatPickTechnique] Failed to create WebGL program");
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || "Program link failed";
      gl.deleteProgram(program);
      throw new Error(`[GaussianSplatPickTechnique] ${info}`);
    }
    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("[GaussianSplatPickTechnique] Failed to create shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || "Shader compile failed";
      gl.deleteShader(shader);
      throw new Error(`[GaussianSplatPickTechnique] ${info}`);
    }
    return shader;
  }

  private getUniformLocation(name: string): WebGLUniformLocation {
    const location = this.gl.getUniformLocation(this.program!, name);
    if (location === null) {
      throw new Error(`[GaussianSplatPickTechnique] Uniform not found: ${name}`);
    }
    return location;
  }
}
