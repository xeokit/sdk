import {SDKErrorType, type SDKResult} from "../../../../core";

/**
 * Pre-integrated BRDF lookup table for the split-sum specular IBL
 * approximation (Karis / Unreal). 256×256 RGBA8, indexed by
 * `(NdotV, roughness)` and returning the scale (`R`) and bias (`G`)
 * applied to the prefiltered specular sample:
 *
 *     specularIBL ≈ prefilteredColor * (F0 * lut.r + lut.g)
 *
 * Generated once per renderer at first use — the table is independent
 * of the environment so all views can share it. ~256 KB on the GPU.
 *
 * The integration uses Hammersley quasi-random sequences with GGX
 * importance sampling and Smith geometry; 1024 samples per fragment.
 * Computed at init time, never updated thereafter.
 */
export class BRDFLUTTexture {

  /** Square size of the LUT, in pixels. 256 is the standard choice. */
  public static readonly SIZE = 256;

  /** Number of importance samples per texel during integration. */
  public static readonly SAMPLES = 1024;

  public gl: WebGL2RenderingContext;
  public texture: WebGLTexture | null = null;
  public allocated: boolean = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Compiles the integration shader, creates the FBO + RG16F target,
   * runs one fullscreen pass, then discards everything except the
   * resulting texture. Idempotent — second call is a no-op.
   */
  public allocate(): SDKResult<void> {
    if (this.allocated) return { ok: true, value: undefined };
    const gl = this.gl;
    let program: WebGLProgram | null = null;
    let fbo: WebGLFramebuffer | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let vbo: WebGLBuffer | null = null;
    try {
      program = compileProgram(gl, FULLSCREEN_VS, BRDF_LUT_FS);
      const tex = gl.createTexture();
      if (!tex) throw new Error("createTexture failed");
      this.texture = tex;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // RGBA8 keeps the LUT compact (256 KB) and is fine for [0, 1]
      // outputs from the integration. RG16F would be cleaner but isn't
      // colour-renderable on all WebGL2 implementations without
      // EXT_color_buffer_float.
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, BRDFLUTTexture.SIZE, BRDFLUTTexture.SIZE);

      fbo = gl.createFramebuffer();
      if (!fbo) throw new Error("createFramebuffer failed");
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`FBO incomplete: 0x${status.toString(16)}`);
      }

      // Fullscreen quad (two triangles).
      vao = gl.createVertexArray();
      vbo = gl.createBuffer();
      if (!vao || !vbo) throw new Error("VAO/VBO alloc failed");
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      // Render the integration pass.
      const prevViewport = gl.getParameter(gl.VIEWPORT);
      gl.viewport(0, 0, BRDFLUTTexture.SIZE, BRDFLUTTexture.SIZE);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.useProgram(program);
      gl.uniform1ui(gl.getUniformLocation(program, "uSamples"), BRDFLUTTexture.SAMPLES);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);

      this.allocated = true;
      return { ok: true, value: undefined };
    } catch (e) {
      if (this.texture) {
        gl.deleteTexture(this.texture);
        this.texture = null;
      }
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[BRDFLUTTexture.allocate] ${e instanceof Error ? e.message : String(e)}`
      };
    } finally {
      // Scratch resources are throw-away — only the texture survives.
      // Order matters: unbind everything from the GL state first, THEN
      // delete. WebGL flags a deleted-but-bound program/FBO/VAO for
      // deferred deletion and can leave dangling bindings that trip up
      // subsequent draw calls (the SkyRenderer was hitting "useProgram:
      // attempt to use a deleted object" because we left the BRDF LUT
      // program bound and then deleted it).
      gl.useProgram(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (program) gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      if (vbo) gl.deleteBuffer(vbo);
      if (fbo) gl.deleteFramebuffer(fbo);
    }
  }

  public webglContextRestored(): SDKResult<void> {
    this.allocated = false;
    this.texture = null;
    return this.allocate();
  }

  public getAllocatedBytes(): number {
    return this.allocated ? BRDFLUTTexture.SIZE * BRDFLUTTexture.SIZE * 4 : 0;
  }

  public destroy(): void {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
    this.allocated = false;
  }
}

/**
 * Helper — compiles vertex + fragment shader sources into a linked
 * program. Throws on failure with a useful info-log; caller is
 * responsible for `gl.deleteProgram`.
 */
function compileProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const compileShader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh) || "shader compile failed";
      gl.deleteShader(sh);
      throw new Error(info);
    }
    return sh;
  };
  const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || "program link failed";
    gl.deleteProgram(prog);
    throw new Error(info);
  }
  return prog;
}

const FULLSCREEN_QUAD = new Float32Array([
  -1, -1,  1, -1,  -1, 1,  1, 1
]);

const FULLSCREEN_VS = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUV;
void main() {
  vUV = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// Standard split-sum BRDF integration shader. Two outputs (R = scale on
// F0, G = bias added to it) fit the standard formulation Karis published
// for Unreal — kept verbatim so any reference implementation matches.
const BRDF_LUT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform uint uSamples;

const float PI = 3.14159265358979;

// Hammersley quasi-random pair using Van der Corput radical inverse.
float radicalInverse_VdC(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return float(bits) * 2.3283064365386963e-10;
}
vec2 hammersley(uint i, uint N) {
  return vec2(float(i) / float(N), radicalInverse_VdC(i));
}

// GGX importance sampling around the +Z hemisphere normal.
vec3 importanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
  float a = roughness * roughness;
  float phi = 2.0 * PI * Xi.x;
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  vec3 H = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
  // Tangent-space → world-space (any orthonormal basis works since we
  // only need the lobe shape, not a specific orientation).
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, N));
  vec3 bitangent = cross(N, tangent);
  return normalize(tangent * H.x + bitangent * H.y + N * H.z);
}

// Schlick-GGX geometry term — note the IBL remap (k = a^2 / 2) is used
// here, NOT the direct-lighting (r+1)^2/8 remap.
float geometrySchlickGGX(float NdotV, float roughness) {
  float a = roughness;
  float k = (a * a) / 2.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}
float geometrySmith(float NdotV, float NdotL, float roughness) {
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

vec2 integrateBRDF(float NdotV, float roughness) {
  vec3 V = vec3(sqrt(1.0 - NdotV * NdotV), 0.0, NdotV);
  vec3 N = vec3(0.0, 0.0, 1.0);
  float A = 0.0;
  float B = 0.0;
  for (uint i = 0u; i < uSamples; ++i) {
    vec2 Xi = hammersley(i, uSamples);
    vec3 H = importanceSampleGGX(Xi, N, roughness);
    vec3 L = normalize(2.0 * dot(V, H) * H - V);
    float NdotL = max(L.z, 0.0);
    if (NdotL > 0.0) {
      float NdotH = max(H.z, 0.0);
      float VdotH = max(dot(V, H), 0.0);
      float G = geometrySmith(NdotV, NdotL, roughness);
      float G_Vis = (G * VdotH) / (NdotH * NdotV);
      float Fc = pow(1.0 - VdotH, 5.0);
      A += (1.0 - Fc) * G_Vis;
      B += Fc * G_Vis;
    }
  }
  return vec2(A, B) / float(uSamples);
}

void main() {
  // vUV.x = NdotV ∈ [0,1], vUV.y = roughness ∈ [0,1]. Clamp NdotV away
  // from 0 to keep the geometry term finite.
  vec2 lut = integrateBRDF(max(vUV.x, 0.0001), vUV.y);
  outColor = vec4(lut, 0.0, 1.0);
}`;
