import {SDKErrorType, type SDKResult} from "../../../../core";
import {BRDFLUTTexture} from "./BRDFLUTTexture";

/**
 * Per-view IBL prefilter pipeline — owns the three samplers the
 * Cook-Torrance BRDF needs for the split-sum approximation:
 *
 *   1. **Environment cubemap** — 256×256×6 RGBA8 with 7 mip levels.
 *      Mip 0 holds the source sky render; mips 1..N hold GGX-prefiltered
 *      versions at progressively higher roughness. Sampled by the
 *      specular IBL term:
 *        `textureLod(uPrefilteredCubemap, R, roughness * MAX_MIP)`
 *
 *   2. **Irradiance cubemap** — 32×32×6 RGBA8, cosine-convolved from
 *      the source sky. Sampled by the diffuse IBL term:
 *        `texture(uIrradianceCubemap, N)`
 *
 *   3. **BRDF LUT** — shared 2D `(NdotV, roughness) → (scale, bias)`
 *      lookup, generated once per renderer (see {@link BRDFLUTTexture}).
 *
 * The pipeline regenerates lazily — call {@link markDirty} when sky
 * params or sun direction change, then {@link refresh} once per frame
 * (cheap when not dirty).
 *
 * v1 limits:
 *   - RGBA8 internal format. Sun intensity clamps at 1.0; HDR support
 *     would require RGBA16F + EXT_color_buffer_float (cheap upgrade
 *     when needed).
 *   - 32 importance samples per prefiltered specular texel — fine for
 *     the small mip sizes (4×4..256×256), would benefit from more
 *     samples at the smaller end but kept low for fast regeneration.
 *   - Single mip on the irradiance cubemap (no filtering needed since
 *     the convolution itself is the blur).
 *
 * Memory cost per view: 256*256*4*6*4/3 ≈ 1.4 MB env + 32*32*4*6 ≈
 * 24 KB irradiance ≈ 1.4 MB total. Plus the shared 256 KB BRDF LUT.
 */

/** Source environment dimension. Higher = sharper mirror reflections. */
const ENV_SIZE = 256;
/** Number of mip levels. log2(256) + 1 = 9, but 7 is enough for visibility. */
const ENV_MIPS = 7;
/** Diffuse irradiance is heavily smoothed — small is fine. */
const IRRADIANCE_SIZE = 32;
/** Importance samples per prefiltered-specular texel. */
const PREFILTER_SAMPLES = 32;
/** Importance samples per irradiance texel. */
const IRRADIANCE_SAMPLES = 64;

/** Sky parameters fed to the procedural sky shader for cubemap rendering. */
export interface SkyParams {
  skyColor: [number, number, number];
  horizonColor: [number, number, number];
  groundColor: [number, number, number];
  horizonBlend: number;
  sunEnabled: boolean;
  sunDirection: [number, number, number];
  sunColor: [number, number, number];
  sunAngularSizeDegrees: number;
  sunGlowSize: number;
  sunGlowIntensity: number;
  worldUp: [number, number, number];
}

const DEFAULT_SKY_PARAMS: SkyParams = {
  skyColor: [0.62, 0.72, 0.86],
  horizonColor: [0.78, 0.84, 0.92],
  groundColor: [0.42, 0.36, 0.30],
  horizonBlend: 0.15,
  sunEnabled: true,
  sunDirection: [0.6, 0.6, 0.6],
  sunColor: [1.0, 0.97, 0.82],
  sunAngularSizeDegrees: 3.0,
  sunGlowSize: 16.0,
  sunGlowIntensity: 0.25,
  worldUp: [0, 0, 1]
};

export class IBLPrefilter {

  public gl: WebGL2RenderingContext;
  public brdfLUT: BRDFLUTTexture;

  /**
   * Source sky cubemap — single-mip, written by the sky pass and then
   * sampled (read-only) by the prefilter and irradiance passes. Kept
   * separate from `environmentCubemap` because WebGL forbids feedback
   * loops where a texture is bound as both an FBO attachment AND a
   * sampler in the same draw call, even if the read mip differs from
   * the write mip.
   */
  public sourceCubemap: WebGLTexture | null = null;

  /**
   * Prefiltered specular cubemap with mip chain. Written by the
   * prefilter pass (reading from `sourceCubemap`); never bound as a
   * sampler during its own writes.
   */
  public environmentCubemap: WebGLTexture | null = null;
  public irradianceCubemap: WebGLTexture | null = null;

  /**
   * When true, the environment + irradiance cubemaps are allocated as
   * RGBA16F instead of RGBA8 — the sun and other bright pixels can
   * exceed 1.0 without clamping, so smooth metals reflecting the sun
   * properly "burn out" the tonemap downstream. Requires the
   * `EXT_color_buffer_float` WebGL2 extension to be active when the
   * pipeline is constructed.
   */
  public readonly hdr: boolean;

  /** Highest valid mip index — passed to the BRDF shader so it can
   * scale roughness into the lod range without re-deriving it. */
  public readonly maxSpecularMipLevel: number = ENV_MIPS - 1;

  public allocated: boolean = false;

  private _params: SkyParams = { ...DEFAULT_SKY_PARAMS };
  private _dirty: boolean = true;

  // Compiled programs — reused across faces and mips.
  private _skyProgram: WebGLProgram | null = null;
  private _prefilterProgram: WebGLProgram | null = null;
  private _irradianceProgram: WebGLProgram | null = null;
  private _equirectProgram: WebGLProgram | null = null;
  private _vao: WebGLVertexArrayObject | null = null;
  private _vbo: WebGLBuffer | null = null;
  private _fbo: WebGLFramebuffer | null = null;

  // When non-null, the user has supplied an equirectangular environment
  // map. The sky pass will project it onto the source cubemap instead
  // of rendering the procedural sky. Cleared via `clearEnvironmentEquirect`.
  private _equirectTexture: WebGLTexture | null = null;
  private _equirectWidth: number = 0;
  private _equirectHeight: number = 0;

  constructor(gl: WebGL2RenderingContext, brdfLUT: BRDFLUTTexture, options: { hdr?: boolean } = {}) {
    this.gl = gl;
    this.brdfLUT = brdfLUT;
    this.hdr = options.hdr === true;
  }

  /** Replace sky params and mark the cubemaps dirty for next refresh. */
  public setParams(params: Partial<SkyParams>): void {
    this._params = { ...this._params, ...params };
    this._dirty = true;
  }

  public markDirty(): void {
    this._dirty = true;
  }

  /**
   * Replace the procedural sky source with an equirectangular
   * environment image. The image is uploaded to a 2D texture once;
   * the sky pass then projects it onto the 6 cubemap faces via the
   * standard latitude/longitude formula and the rest of the
   * pipeline (prefilter / irradiance) runs unchanged.
   *
   * Pass any `texSubImage2D`-compatible source — `HTMLImageElement`,
   * `HTMLCanvasElement`, `ImageBitmap`, or `OffscreenCanvas`. Sources
   * whose width is roughly twice their height (the standard equirect
   * aspect) sample correctly without distortion.
   *
   * Call {@link clearEnvironmentEquirect} to revert to the procedural sky.
   */
  public setEnvironmentEquirect(source: TexImageSource): SDKResult<void> {
    if (!this.allocated) {
      const r = this.allocate();
      if (!r.ok) return r;
    }
    const gl = this.gl;
    const w = (source as any).width || (source as any).naturalWidth || 0;
    const h = (source as any).height || (source as any).naturalHeight || 0;
    if (w <= 0 || h <= 0) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[IBLPrefilter.setEnvironmentEquirect] source has zero dimensions"
      };
    }
    if (!this._equirectTexture) {
      const tex = gl.createTexture();
      if (!tex) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[IBLPrefilter.setEnvironmentEquirect] createTexture failed"
        };
      }
      this._equirectTexture = tex;
    }
    gl.bindTexture(gl.TEXTURE_2D, this._equirectTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // Equirect images are conceptually colour data — let the GPU
    // sRGB-decode on sample so the prefilter operates in linear.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);            // u wraps around longitude
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);     // v clamps at the poles
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._equirectWidth = w;
    this._equirectHeight = h;
    this._dirty = true;
    return { ok: true, value: undefined };
  }

  /**
   * Replace the procedural sky source with a Float32 RGBA equirectangular
   * HDR image. Same effect as {@link setEnvironmentEquirect}, but the
   * texture is uploaded as `RGBA16F` so the prefilter pipeline preserves
   * super-bright pixels (the sun, sky-glow) instead of clamping them
   * to 1.0.
   *
   * `pixels` is row-major top-down RGBA, length `width * height * 4`.
   * Typical source is {@link parseHDR} on a Radiance `.hdr` file.
   *
   * Requires `EXT_color_buffer_float` to have been activated at renderer
   * init — without it the prefilter cubemaps are RGBA8 anyway, so the
   * HDR data is uploaded losslessly into the equirect texture but then
   * clamps when projected onto the cubemap. (The shader path is
   * identical; only the destination format differs.)
   */
  public setEnvironmentEquirectHDR(
    pixels: Float32Array,
    width: number,
    height: number
  ): SDKResult<void> {
    if (!this.allocated) {
      const r = this.allocate();
      if (!r.ok) return r;
    }
    const gl = this.gl;
    if (width <= 0 || height <= 0) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[IBLPrefilter.setEnvironmentEquirectHDR] invalid dimensions ${width}x${height}`
      };
    }
    const expected = width * height * 4;
    if (pixels.length !== expected) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[IBLPrefilter.setEnvironmentEquirectHDR] pixel buffer length ${pixels.length} != ${expected} (${width}x${height} RGBA)`
      };
    }
    if (!this._equirectTexture) {
      const tex = gl.createTexture();
      if (!tex) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[IBLPrefilter.setEnvironmentEquirectHDR] createTexture failed"
        };
      }
      this._equirectTexture = tex;
    }
    gl.bindTexture(gl.TEXTURE_2D, this._equirectTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // Source pixels are already linear-light Float32 — no sRGB decode
    // wanted on sample. RGBA16F is filterable by default in WebGL2.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._equirectWidth = width;
    this._equirectHeight = height;
    this._dirty = true;
    return { ok: true, value: undefined };
  }

  /** Drop any user-supplied equirect environment and fall back to the
   *  procedural sky source on next refresh. */
  public clearEnvironmentEquirect(): void {
    if (this._equirectTexture) {
      this.gl.deleteTexture(this._equirectTexture);
      this._equirectTexture = null;
      this._equirectWidth = 0;
      this._equirectHeight = 0;
      this._dirty = true;
    }
  }

  /** True when an equirect environment has been supplied. */
  public get hasEquirectEnvironment(): boolean {
    return this._equirectTexture !== null;
  }

  /**
   * Allocates GPU resources — cubemap textures with mip storage, the
   * shared FBO, programs, and the fullscreen-quad VBO. Idempotent.
   */
  public allocate(): SDKResult<void> {
    if (this.allocated) return { ok: true, value: undefined };
    const gl = this.gl;
    // RGBA16F (HDR) keeps super-bright pixels (sun, sky-glow) intact so
    // smooth metals reflecting the sun render at proper HDR intensity
    // and tonemap into a clean specular bloom. Falls back to RGBA8
    // if EXT_color_buffer_float wasn't available at renderer init —
    // shader path is identical, just clamps writes.
    const internalFormat = this.hdr ? gl.RGBA16F : gl.RGBA8;
    try {
      // Source sky cubemap — single mip, sampled-only. Sky pass writes
      // to this; prefilter + irradiance passes read from it.
      const src = gl.createTexture();
      if (!src) throw new Error("createTexture (source) failed");
      this.sourceCubemap = src;
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, src);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 1, internalFormat, ENV_SIZE, ENV_SIZE);

      // Prefiltered environment cubemap with mip storage. Mip 0 holds
      // a near-perfect mirror copy of the source (prefilter pass at
      // roughness=0 collapses the GGX lobe to a delta at L=N); mips
      // 1..N hold progressively-rougher GGX convolutions of the same
      // source.
      const env = gl.createTexture();
      if (!env) throw new Error("createTexture (env) failed");
      this.environmentCubemap = env;
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, env);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_CUBE_MAP, ENV_MIPS, internalFormat, ENV_SIZE, ENV_SIZE);

      // Diffuse irradiance cubemap — small, single mip. Same internal
      // format as the source so the convolution preserves HDR sun
      // contribution baked into the irradiance signal.
      const irr = gl.createTexture();
      if (!irr) throw new Error("createTexture (irradiance) failed");
      this.irradianceCubemap = irr;
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, irr);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 1, internalFormat, IRRADIANCE_SIZE, IRRADIANCE_SIZE);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      const fbo = gl.createFramebuffer();
      if (!vao || !vbo || !fbo) throw new Error("VAO/VBO/FBO alloc failed");
      this._vao = vao; this._vbo = vbo; this._fbo = fbo;

      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      this._skyProgram = compileProgram(gl, FULLSCREEN_VS, SKY_FS);
      this._prefilterProgram = compileProgram(gl, FULLSCREEN_VS, PREFILTER_FS);
      this._irradianceProgram = compileProgram(gl, FULLSCREEN_VS, IRRADIANCE_FS);
      this._equirectProgram = compileProgram(gl, FULLSCREEN_VS, EQUIRECT_FS);

      const lutResult = this.brdfLUT.allocate();
      if (lutResult.ok === false) throw new Error(`BRDF LUT allocate: ${lutResult.error}`);

      this.allocated = true;
      return { ok: true, value: undefined };
    } catch (e) {
      this._releaseResources();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[IBLPrefilter.allocate] ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  /**
   * Re-renders the cubemaps if dirty. No-op when clean. Call once per
   * frame (or whenever params might have changed). Cost: ~6 sky-face
   * draws + 6×6 prefilter draws + 6 irradiance draws + a mipmap
   * generation. ~5 ms on a desktop GPU; only runs when dirty.
   */
  public refresh(): SDKResult<void> {
    if (!this.allocated) {
      const r = this.allocate();
      if (!r.ok) return r;
    }
    if (!this._dirty) return { ok: true, value: undefined };

    const gl = this.gl;
    // Cache + restore viewport / FBO since the caller is mid-render.
    const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const prevViewport = gl.getParameter(gl.VIEWPORT);
    const prevDepthTest = gl.getParameter(gl.DEPTH_TEST);
    const prevBlend = gl.getParameter(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    gl.bindVertexArray(this._vao);

    try {
      this._renderSkyToEnvCubemap();
      this._prefilterSpecular();
      this._convolveIrradiance();
      this._dirty = false;
      return { ok: true, value: undefined };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[IBLPrefilter.refresh] ${e instanceof Error ? e.message : String(e)}`
      };
    } finally {
      // Clear the active program + cubemap binding so a refresh failure
      // can't leak stale state into the next frame's renderer (which
      // re-enters with its own useProgram + bindTexture). Without this,
      // a thrown error mid-refresh leaves the GPU debugger flagging
      // unrelated useProgram calls in subsequent passes.
      gl.useProgram(null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
      gl.bindVertexArray(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
      gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
      if (prevDepthTest) gl.enable(gl.DEPTH_TEST);
      if (prevBlend) gl.enable(gl.BLEND);
    }
  }

  /**
   * Write the source cubemap. Two paths share the same FBO + viewport
   * loop:
   *
   *   - **Equirect** — when the user has supplied an environment image
   *     via {@link setEnvironmentEquirect}, the equirect program
   *     samples the 2D texture via the latitude/longitude formula.
   *   - **Procedural sky** — otherwise, the sky shader produces the
   *     three-band gradient + sun disc.
   */
  private _renderSkyToEnvCubemap(): void {
    const gl = this.gl;
    const useEquirect = this._equirectTexture !== null;
    const program = useEquirect ? this._equirectProgram! : this._skyProgram!;
    gl.useProgram(program);
    gl.viewport(0, 0, ENV_SIZE, ENV_SIZE);

    let uFace: WebGLUniformLocation | null;
    if (useEquirect) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._equirectTexture);
      gl.uniform1i(gl.getUniformLocation(program, "uEquirect"), 0);
      // Pass scene up-axis so the equirect's top maps to world up.
      // Without this, Z-up scenes sample sky content where horizon
      // belongs and reflections come out wrong.
      const up = this._params.worldUp;
      gl.uniform3f(gl.getUniformLocation(program, "uWorldUp"), up[0], up[1], up[2]);
      uFace = gl.getUniformLocation(program, "uFace");
    } else {
      this._uploadSkyUniforms(program);
      uFace = gl.getUniformLocation(program, "uFace");
    }

    for (let face = 0; face < 6; face++) {
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        this.sourceCubemap!,
        0
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`sky FBO incomplete (face ${face}): 0x${status.toString(16)}`);
      }
      gl.uniform1i(uFace, face);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    if (useEquirect) {
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  /**
   * GGX-importance-sample the source cubemap into the prefiltered
   * environment cubemap's mips 0..N at progressively higher roughness.
   * Mip 0 runs at roughness=0 — the importance-sampling lobe collapses
   * to a delta at L=N, producing what's essentially a 1:1 copy of the
   * source. Mip N runs at roughness=1 (fully diffuse-blurred). Sample
   * count is constant across mips because higher mips are smaller in
   * pixel count, so the absolute work scales sensibly.
   *
   * Avoids the WebGL feedback-loop restriction by reading from a
   * separate `sourceCubemap` while writing to `environmentCubemap`.
   */
  private _prefilterSpecular(): void {
    const gl = this.gl;
    const program = this._prefilterProgram!;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.sourceCubemap);
    gl.uniform1i(gl.getUniformLocation(program, "uEnvironment"), 0);
    gl.uniform1ui(gl.getUniformLocation(program, "uSamples"), PREFILTER_SAMPLES);
    const uFace = gl.getUniformLocation(program, "uFace");
    const uRoughness = gl.getUniformLocation(program, "uRoughness");

    for (let mip = 0; mip < ENV_MIPS; mip++) {
      const mipSize = ENV_SIZE >> mip;
      gl.viewport(0, 0, mipSize, mipSize);
      const roughness = mip / (ENV_MIPS - 1);
      gl.uniform1f(uRoughness, roughness);
      for (let face = 0; face < 6; face++) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
          this.environmentCubemap!,
          mip
        );
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error(`prefilter FBO incomplete (mip ${mip} face ${face}): 0x${status.toString(16)}`);
        }
        gl.uniform1i(uFace, face);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  }

  /** Cosine-convolve the source cubemap into the small irradiance cubemap. */
  private _convolveIrradiance(): void {
    const gl = this.gl;
    const program = this._irradianceProgram!;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.sourceCubemap);
    gl.uniform1i(gl.getUniformLocation(program, "uEnvironment"), 0);
    gl.uniform1ui(gl.getUniformLocation(program, "uSamples"), IRRADIANCE_SAMPLES);
    const uFace = gl.getUniformLocation(program, "uFace");
    gl.viewport(0, 0, IRRADIANCE_SIZE, IRRADIANCE_SIZE);
    for (let face = 0; face < 6; face++) {
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        this.irradianceCubemap!,
        0
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`irradiance FBO incomplete (face ${face}): 0x${status.toString(16)}`);
      }
      gl.uniform1i(uFace, face);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  private _uploadSkyUniforms(program: WebGLProgram): void {
    const gl = this.gl;
    const p = this._params;
    const set3 = (name: string, v: [number, number, number]) =>
      gl.uniform3f(gl.getUniformLocation(program, name), v[0], v[1], v[2]);
    const set1 = (name: string, v: number) =>
      gl.uniform1f(gl.getUniformLocation(program, name), v);
    set3("uSkyColor", p.skyColor);
    set3("uHorizonColor", p.horizonColor);
    set3("uGroundColor", p.groundColor);
    set1("uHorizonBlend", p.horizonBlend);
    gl.uniform1i(gl.getUniformLocation(program, "uSunEnabled"), p.sunEnabled ? 1 : 0);
    set3("uSunDirection", p.sunDirection);
    set3("uSunColor", p.sunColor);
    const cosSize = Math.cos((p.sunAngularSizeDegrees * Math.PI / 180.0) * 0.5);
    set1("uSunCosSize", cosSize);
    set1("uSunGlowSize", p.sunGlowSize);
    set1("uSunGlowIntensity", p.sunGlowIntensity);
    set3("uWorldUp", p.worldUp);
  }

  public webglContextRestored(): SDKResult<void> {
    this._releaseResources();
    this.allocated = false;
    this._dirty = true;
    return this.allocate();
  }

  public getAllocatedBytes(): number {
    if (!this.allocated) return 0;
    const bytesPerTexel = this.hdr ? 8 : 4; // RGBA16F vs RGBA8
    const sourceBytes = ENV_SIZE * ENV_SIZE * bytesPerTexel * 6;
    let envBytes = 0;
    for (let mip = 0; mip < ENV_MIPS; mip++) {
      const s = ENV_SIZE >> mip;
      envBytes += s * s * bytesPerTexel * 6;
    }
    const irrBytes = IRRADIANCE_SIZE * IRRADIANCE_SIZE * bytesPerTexel * 6;
    return sourceBytes + envBytes + irrBytes + this.brdfLUT.getAllocatedBytes();
  }

  public destroy(): void {
    this._releaseResources();
  }

  private _releaseResources(): void {
    const gl = this.gl;
    if (this.sourceCubemap)      { gl.deleteTexture(this.sourceCubemap);      this.sourceCubemap = null; }
    if (this.environmentCubemap) { gl.deleteTexture(this.environmentCubemap); this.environmentCubemap = null; }
    if (this.irradianceCubemap)  { gl.deleteTexture(this.irradianceCubemap);  this.irradianceCubemap = null; }
    if (this._equirectTexture)   { gl.deleteTexture(this._equirectTexture);   this._equirectTexture = null; }
    if (this._skyProgram)        { gl.deleteProgram(this._skyProgram);        this._skyProgram = null; }
    if (this._prefilterProgram)  { gl.deleteProgram(this._prefilterProgram);  this._prefilterProgram = null; }
    if (this._irradianceProgram) { gl.deleteProgram(this._irradianceProgram); this._irradianceProgram = null; }
    if (this._equirectProgram)   { gl.deleteProgram(this._equirectProgram);   this._equirectProgram = null; }
    if (this._vao)               { gl.deleteVertexArray(this._vao);           this._vao = null; }
    if (this._vbo)               { gl.deleteBuffer(this._vbo);                this._vbo = null; }
    if (this._fbo)               { gl.deleteFramebuffer(this._fbo);           this._fbo = null; }
  }
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const FULLSCREEN_QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const FULLSCREEN_VS = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUV;
void main() {
  vUV = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// Helper functions shared by all three IBL passes — Hammersley, GGX
// importance sampling, cubemap face → world direction.
const SHARED_GLSL = `
const float PI = 3.14159265358979;

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

vec3 importanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
  float a = roughness * roughness;
  float phi = 2.0 * PI * Xi.x;
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  vec3 H = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, N));
  vec3 bitangent = cross(N, tangent);
  return normalize(tangent * H.x + bitangent * H.y + N * H.z);
}

// Cubemap face index (0..5) + UV ∈ [0,1] → world-space direction. The
// orientation matches the OpenGL TEXTURE_CUBE_MAP_POSITIVE_X enum order
// expected by texture sampling, so a sample of \`R\` at face 0 with the
// formula below produces the same world direction that
// \`textureCubeMap(envCube, R)\` would later return.
vec3 cubemapFaceDir(int face, vec2 uv) {
  vec2 t = uv * 2.0 - 1.0;
  vec3 d;
  if (face == 0)      d = vec3( 1.0, -t.y, -t.x);
  else if (face == 1) d = vec3(-1.0, -t.y,  t.x);
  else if (face == 2) d = vec3( t.x,  1.0,  t.y);
  else if (face == 3) d = vec3( t.x, -1.0, -t.y);
  else if (face == 4) d = vec3( t.x, -t.y,  1.0);
  else                d = vec3(-t.x, -t.y, -1.0);
  return normalize(d);
}
`;

// Procedural sky shader — same look as the existing SkyRenderer:
// three-band gradient, sun disc, glow that brightens the horizon.
// Output is linear RGB clamped to [0, 1] (RGBA8).
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform int uFace;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uGroundColor;
uniform float uHorizonBlend;
uniform int uSunEnabled;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uSunCosSize;
uniform float uSunGlowSize;
uniform float uSunGlowIntensity;
uniform vec3 uWorldUp;
${SHARED_GLSL}
void main() {
  vec3 dir = cubemapFaceDir(uFace, vUV);
  vec3 up = normalize(uWorldUp);
  vec3 sunDir = normalize(uSunDirection);
  float t = dot(dir, up);
  // Three-band gradient (sky → horizon → ground).
  vec3 col;
  if (t > 0.0) {
    float k = clamp(t / max(uHorizonBlend, 1e-3), 0.0, 1.0);
    col = mix(uHorizonColor, uSkyColor, smoothstep(0.0, 1.0, k));
  } else {
    float k = clamp(-t / max(uHorizonBlend, 1e-3), 0.0, 1.0);
    col = mix(uHorizonColor, uGroundColor, smoothstep(0.0, 1.0, k));
  }
  // Sun glow brightens whatever direction is close to the sun, including
  // the horizon haze. Drops off with the dot product raised to glowSize.
  float sunDot = dot(dir, sunDir);
  if (sunDot > 0.0) {
    float glow = pow(sunDot, uSunGlowSize) * uSunGlowIntensity;
    col += uSunColor * glow;
  }
  // Sun disc — sharp cutoff at the angular size.
  if (uSunEnabled == 1 && sunDot > uSunCosSize) {
    col = uSunColor;
  }
  outColor = vec4(col, 1.0);
}`;

// Project an equirectangular environment map onto a cubemap face.
// For each fragment we compute the world-space direction the cube
// face would expose at that texel, convert it to (longitude,
// latitude), and sample the 2D map.
//
// Equirect convention: zenith (along `uWorldUp`) maps to the top of
// the image (v = 0), nadir to the bottom (v = 1), horizon ring to the
// middle. U wraps around longitude. We build an orthonormal basis on
// the fly from `uWorldUp` so this works for any scene up-axis (Z-up
// xeokit defaults, Y-up glTF, etc.) — without it, a Z-up scene
// reflects the equirect's horizon content where its sky belongs.
const EQUIRECT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uEquirect;
uniform int uFace;
uniform vec3 uWorldUp;
${SHARED_GLSL}
const float INV_TWO_PI = 0.15915494309189535;
const float INV_PI     = 0.31830988618379067;
void main() {
  vec3 dir = cubemapFaceDir(uFace, vUV);
  vec3 up = normalize(uWorldUp);
  // Pick an "east" direction in the horizontal plane. Cross with the
  // world X axis when up is far from X, otherwise with Y, so we never
  // produce a degenerate (zero-length) east vector.
  vec3 ref = abs(up.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 east  = normalize(cross(up, ref));
  vec3 north = cross(east, up);
  // Latitude: angle above/below the horizon ring.
  // Longitude: angle around the up axis, measured from north toward east.
  float lat = asin(clamp(dot(dir, up), -1.0, 1.0));
  float lon = atan(dot(dir, east), dot(dir, north));
  float u = 0.5 + lon * INV_TWO_PI;
  float v = 0.5 - lat * INV_PI;
  outColor = texture(uEquirect, vec2(u, v));
}`;

// GGX-importance-sample the source cubemap into a target mip at the
// given roughness. Standard split-sum prefilter — see Karis 2013.
const PREFILTER_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform samplerCube uEnvironment;
uniform int uFace;
uniform float uRoughness;
uniform uint uSamples;
${SHARED_GLSL}
void main() {
  vec3 N = cubemapFaceDir(uFace, vUV);
  // Split-sum approximation: assume V == N.
  vec3 V = N;
  vec3 prefilteredColor = vec3(0.0);
  float totalWeight = 0.0;
  for (uint i = 0u; i < uSamples; ++i) {
    vec2 Xi = hammersley(i, uSamples);
    vec3 H = importanceSampleGGX(Xi, N, uRoughness);
    vec3 L = normalize(2.0 * dot(V, H) * H - V);
    float NdotL = max(dot(N, L), 0.0);
    if (NdotL > 0.0) {
      // Sample mip 0 of the source — the unfiltered sky. For roughness
      // close to 0 this barely matters because the lobe is a delta;
      // higher roughness spreads the lobe and aliasing here would
      // benefit from cosine-mipping the source, but for a small sample
      // count the visual impact is minimal.
      prefilteredColor += textureLod(uEnvironment, L, 0.0).rgb * NdotL;
      totalWeight += NdotL;
    }
  }
  outColor = vec4(prefilteredColor / max(totalWeight, 1e-4), 1.0);
}`;

// Cosine-weighted hemisphere convolution — diffuse irradiance.
const IRRADIANCE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform samplerCube uEnvironment;
uniform int uFace;
uniform uint uSamples;
${SHARED_GLSL}
void main() {
  vec3 N = cubemapFaceDir(uFace, vUV);
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(up, N));
  up = cross(N, right);
  vec3 irradiance = vec3(0.0);
  float totalWeight = 0.0;
  for (uint i = 0u; i < uSamples; ++i) {
    vec2 Xi = hammersley(i, uSamples);
    // Cosine-weighted hemisphere sample (Malley's method).
    float cosTheta = sqrt(1.0 - Xi.y);
    float sinTheta = sqrt(Xi.y);
    float phi = 2.0 * PI * Xi.x;
    vec3 dir = right * (cos(phi) * sinTheta)
             + up    * (sin(phi) * sinTheta)
             + N     *  cosTheta;
    irradiance += textureLod(uEnvironment, dir, 0.0).rgb * cosTheta;
    totalWeight += cosTheta;
  }
  outColor = vec4(irradiance / max(totalWeight, 1e-4), 1.0);
}`;

function compileProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh) || "compile failed";
      gl.deleteShader(sh);
      throw new Error(info);
    }
    return sh;
  };
  const v = compile(gl.VERTEX_SHADER, vs);
  const f = compile(gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || "link failed";
    gl.deleteProgram(prog);
    throw new Error(info);
  }
  return prog;
}
