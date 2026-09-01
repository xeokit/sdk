import {EventEmitter, SDKErrorType, type SDKResult} from "../../../../../../base/core";
import {RepeatWrapping} from "../../../../../../base/constants";
import {EventDispatcher} from "strongly-typed-events";
import {
  createSanitizedAlphaMaskedColorImageData,
  sanitizeAlphaMaskedColorImageData
} from "../../../../common/AlphaMaskedTexture";

/**
 * UV transform that maps a mesh's `[0, 1]` UVs into its sub-rect of the
 * atlas. `atlasUV = vUV * (uScale, vScale) + (uOffset, vOffset)`.
 *
 * For untextured meshes the renderer writes the {@link SENTINEL_TRANSFORM}
 * (scale = 0), which collapses every fragment to a single pre-stamped
 * white texel.
 */
export interface AtlasTransform {
  uOffset: number;
  vOffset: number;
  uScale: number;
  vScale: number;
}

export type ImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | ImageData;

export type TextureAtlasUploadOptions = {
  sanitizeAlphaMaskRGB?: boolean;
  wrapS?: number;
  wrapT?: number;
};

interface Shelf {
  /** Top edge of this shelf, in atlas pixels. */
  y: number;
  /** Height of the shelf — the tallest texture it holds, including padding. */
  height: number;
  /** Width consumed so far (next free x). */
  usedWidth: number;
}

interface AtlasEntry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  source: ImageSource;
  sanitizeAlphaMaskRGB: boolean;
  wrapS?: number;
  wrapT?: number;
}

const ALPHA_MASK_RGB_ENTRY_SUFFIX = "::alphaMaskRGB";

/**
 * Shared GL resources for the gamma-correct mip-pyramid pass used
 * on sRGB atlases. One set per WebGL context, cached in
 * {@link TextureAtlas._mipPassCache}: a 3-vertex fullscreen-triangle
 * shader program, an empty VAO for `gl_VertexID`-driven draws, and
 * a reusable framebuffer that the per-level attachment swaps into.
 */
interface MipPassResources {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  fbo: WebGLFramebuffer;
  uSrc: WebGLUniformLocation;
}

/**
 * GPU 2D shelf-packed texture atlas — one per PBR map type per
 * {@link GPUMemoryBatch} (albedo, metallic-roughness, future normals /
 * occlusion / emissive).
 *
 * Each {@link addTexture | added image} occupies a sub-rect with a
 * configurable padding gutter (default 2 px) to mitigate bilinear bleed.
 * Returns an {@link AtlasTransform} the caller writes to the per-mesh
 * attribute texture; the shader applies that transform per-fragment.
 *
 * Use `internalFormat` to switch between sRGB-decoded (albedo) and
 * linear (MR / normals / occlusion / emissive HDR-prep) atlases.
 *
 * v1 limitations:
 *   - Single mip level. Bilinear filtering only — no anisotropic, no mips.
 *   - No atlas growth. Once {@link allocate} fixes the size, overflow on
 *     {@link addTexture} returns `null` and the caller falls back to the
 *     sentinel.
 *   - Sources larger than the atlas size are auto-downscaled to fit
 *     (aspect-preserving) inside {@link addTexture}, emitting a warn-level
 *     message with the original and new dimensions. This keeps streaming
 *     scenes with unpredictable content sizes rendering with their PBR
 *     detail instead of falling through to the sentinel; the renderer is
 *     designed for continuous load/unload of varied content, so refusing
 *     a too-big texture would surface an end-user-visible artefact rather
 *     than a quietly lossy upload.
 *   - Same image registered twice gets a single shared sub-rect (cached
 *     by `SceneTexture.id`).
 *   - Tiling textures need to be pre-modulated into `[0, 1)` before
 *     quantisation; the atlas's wrap mode is `CLAMP_TO_EDGE`.
 *
 * Coordinate convention: the atlas reserves a 4×4 white sentinel block at
 * the top-left so untextured meshes can sample (1, 1, 1, 1) via a
 * zero-scale UV transform — exactly the right value for both albedo
 * (multiplies through unchanged) and metallic-roughness (passes the
 * material's roughness/metallic through unchanged).
 */
export class TextureAtlas {

  /**
   * Default atlas dimension (square). 4096 means each atlas occupies
   * 64 MB of GPU memory (×4 bytes RGBA × 3 atlas types per UV-bearing
   * batch = ~192 MB). The trade-off is fewer batch splits on
   * texture-heavy models like Sponza — at 2048 the same model would
   * spawn ~5-8 batches just from atlas overflow.
   */
  public static readonly DEFAULT_SIZE = 4096;

  /** Default gutter (pixels) around each entry. */
  public static readonly DEFAULT_PADDING = 2;

  /**
   * Gutter (pixels) around each entry on a mipmapped atlas. Each
   * mip level halves the entry's footprint, so adjacent entries
   * can bleed across the original level-0 boundary at higher
   * levels. `32` keeps large repeated road/building textures from
   * averaging against the neutral atlas fill through most visible mip
   * levels, while still wasting only a small fraction of a 4096 atlas.
   */
  public static readonly DEFAULT_PADDING_MIPMAP = 32;

  /**
   * Per-GL-context cache of the resources used by the sRGB
   * mip-pass downsample (see {@link _generateSRGBMipmapsViaShader}).
   * Compiling the program once and reusing the FBO + VAO across
   * every atlas that shares a context keeps the per-atlas cost of
   * mip regeneration to N small `drawArrays` calls. A cache entry
   * of `null` means we attempted compilation and failed — don't
   * retry on every flush.
   */
  private static _mipPassCache: WeakMap<WebGL2RenderingContext, MipPassResources | null> = new WeakMap();

  /**
   * UV transform for "no texture" — collapses every fragment to the
   * sentinel white texel at atlas (0.5/size, 0.5/size). Initialised in
   * {@link allocate}.
   */
  public sentinelTransform: AtlasTransform = { uOffset: 0, vOffset: 0, uScale: 0, vScale: 0 };

  public gl: WebGL2RenderingContext;
  public texture: WebGLTexture | null = null;

  /** Atlas square size in pixels. */
  public size: number;
  /** Padding (gutter) reserved around each entry. */
  public padding: number;
  /** WebGL internal format — selects sRGB-decoded vs linear sampling. */
  public internalFormat: number;
  /**
   * RGBA byte value the 4×4 sentinel block is filled with. Most atlases
   * use white `(255, 255, 255, 255)` because that's the multiplicative
   * identity for albedo / MR / occlusion. Normal-map atlases override
   * to `(128, 128, 255, 255)` so the decoded tangent-space normal is
   * `(0, 0, 1)` — i.e. "no perturbation" — for untextured meshes.
   */
  public sentinelColor: [number, number, number, number];

  /** True when {@link allocate} has succeeded. */
  public allocated: boolean = false;

  /**
   * `true` when the atlas allocates a capped mip chain and samples
   * it trilinearly. Set from the constructor option; `false` keeps
   * the cheap single-level path.
   */
  public mipmap: boolean = false;

  /**
   * Number of mip levels allocated for this atlas. Mipmapped atlases
   * intentionally stop at the deepest level where the entry gutter still
   * protects sub-rect samples; beyond that level, atlas entries can bleed
   * into neighbours or sentinel fill.
   */
  private _mipLevels: number = 1;

  /** Highest mip level the sampler is allowed to use. */
  private _maxSampleMipLevel: number = 0;

  /**
   * Set by `addTexture` / `updateTexture` when a level-0 write
   * has happened since the last `gl.generateMipmap`; cleared by
   * {@link flushMipmaps}. Lets the atlas batch many level-0
   * mutations and pay one capped-chain regeneration per draw instead
   * of N regenerations during the burst.
   */
  private _mipsDirty: boolean = false;

  /**
   * Notifies inspectors that the atlas was modified. Fires when entries
   * are added or after {@link webglContextRestored} re-stamps everything.
   */
  public onUpdated = new EventEmitter(new EventDispatcher<TextureAtlas, undefined>());

  private _description: string;
  private _shelves: Shelf[] = [];
  private _entries: Map<string, AtlasEntry & AtlasTransform> = new Map();

  constructor(options: {
    gl: WebGL2RenderingContext;
    description: string;
    size?: number;
    padding?: number;
    /**
     * WebGL internal format. Defaults to `SRGB8_ALPHA8` for the colour
     * pipeline; pass `gl.RGBA8` for linear data (metallic-roughness,
     * normal maps, etc.).
     */
    internalFormat?: number;
    /**
     * Sentinel pixel colour as four bytes. Defaults to white. Override
     * with `[128, 128, 255, 255]` for normal-map atlases so the
     * untextured-fallback decodes to a flat tangent-space normal.
     */
    sentinelColor?: [number, number, number, number];
    /**
     * Allocate the atlas with a capped mip chain and sample
     * trilinearly. Default `false`. When `true`, texture uploads
     * mark the chain dirty and the next draw refreshes it once for
     * the atlas.
     */
    mipmap?: boolean;
  }) {
    this.gl = options.gl;
    this._description = options.description;
    this.size = options.size ?? TextureAtlas.DEFAULT_SIZE;
    this.mipmap = options.mipmap === true;
    // Mipmapped atlases need a wider gutter — see DEFAULT_PADDING_MIPMAP.
    const defaultPadding = this.mipmap
      ? TextureAtlas.DEFAULT_PADDING_MIPMAP
      : TextureAtlas.DEFAULT_PADDING;
    this.padding = options.padding ?? defaultPadding;
    this.internalFormat = options.internalFormat ?? options.gl.SRGB8_ALPHA8;
    this.sentinelColor = options.sentinelColor ?? [255, 255, 255, 255];
    if (this.mipmap) {
      const fullMipLevels = Math.floor(Math.log2(this.size)) + 1;
      this._maxSampleMipLevel = Math.min(
        fullMipLevels - 1,
        Math.max(0, Math.floor(Math.log2(Math.max(1, this.padding))))
      );
      this._mipLevels = this._maxSampleMipLevel + 1;
    }
  }

  /**
   * Creates the GPU texture and stamps the sentinel white block. Required
   * before {@link addTexture}. Idempotent re-allocation isn't supported —
   * call {@link destroy} first.
   */
  public allocate(): SDKResult<void> {
    if (this.allocated) {
      return { ok: true, value: undefined };
    }
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TextureAtlas.allocate] Texture creation failed`
      };
    }
    this.texture = tex;
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // CLAMP_TO_EDGE: sub-rects can't legally tile, and the gutter pads
      // bilinear samples away from neighbours so we don't bleed.
      // Min-filter switches based on mipmap opt-in: trilinear when
      // mipmapped (samples blend between two adjacent mip levels),
      // bilinear otherwise (single-level filtered sample). Mipmapped
      // atlas sampling is capped to the deepest level where an entry's
      // gutter still protects sub-rects from neighbour/sentinel bleed.
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        this.mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, this._maxSampleMipLevel);
      // Internal format dictates whether the GPU sRGB-decodes on sample.
      // Albedo uses SRGB8_ALPHA8 (sRGB-encoded source → linear sample);
      // MR / normals / occlusion use RGBA8 (linear all the way).
      gl.texStorage2D(gl.TEXTURE_2D, this._mipLevels, this.internalFormat, this.size, this.size);
      // Pre-fill every level-0 texel with `sentinelColor`. Without
      // this, `texStorage2D` leaves contents undefined (zeros on
      // every browser we've shipped against), which on a mipmapped
      // atlas shows up as dark seams: at high mip levels
      // `generateMipmap`'s box filter averages each slice's edge
      // texels with the dark gutter and dark neighbouring-slice
      // bleed. Pre-filling makes the gutter read as the neutral
      // fallback (white for albedo, neutral-tangent for normal
      // maps) so the bleed is harmless. The sentinel-corner stamp
      // below is then redundant but kept for clarity / robustness
      // against any code path that fills the gutter later.
      this._fillSentinel();
      this._stampSentinel();
      // Initial mip pyramid: level-0 is now uniformly `sentinelColor`
      // (post-fill) plus the 4×4 sentinel stamp at the origin (same
      // colour). Regenerating propagates that to levels 1..N so a
      // sentinel sample at any mip level returns the same colour, and
      // untextured meshes look identical regardless of mip mode.
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (this.mipmap) {
        this._regenerateMipmaps();
      }
      this.allocated = true;
      // Sentinel transform: scale = 0 collapses any input UV to a single
      // point. Offset is the centre of the 4×4 white block at (0, 0).
      const sentinelCentre = (4 * 0.5) / this.size;
      this.sentinelTransform = {
        uOffset: sentinelCentre,
        vOffset: sentinelCentre,
        uScale: 0,
        vScale: 0
      };
      // Reserve the sentinel area in the shelf packer so future entries
      // never overlap it.
      this._shelves.push({ y: 0, height: 4 + this.padding, usedWidth: 4 + this.padding });
      return { ok: true, value: undefined };
    } catch (e) {
      gl.deleteTexture(tex);
      this.texture = null;
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TextureAtlas.allocate] Exception during atlas allocation: ${e}`
      };
    }
  }

  /**
   * Aspect-preserving downscale of a source to fit inside the atlas.
   *
   * Used by {@link addTexture} when the incoming texture would exceed
   * `this.size` (after padding). Draws into an `OffscreenCanvas` when
   * available, falling back to an `HTMLCanvasElement` in DOM-bearing
   * contexts; both forms are accepted directly by `texSubImage2D`. In
   * environments where neither exists (worker contexts without
   * `OffscreenCanvas`, non-DOM tests) returns `null` and the caller
   * falls through to the sentinel — consistent with the pre-downscale
   * behaviour on too-big inputs.
   *
   * Uses `imageSmoothingQuality = "high"` so the downsample preserves
   * as much detail as the browser's resampler allows (typically a
   * bicubic / Lanczos approximation).
   */
  private _downscaleSource(source: ImageSource, targetW: number, targetH: number): ImageSource | null {
    let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(targetW, targetH);
    } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const c = document.createElement("canvas");
      c.width = targetW;
      c.height = targetH;
      canvas = c;
    }
    if (!canvas) return null;
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    try {
      ctx.drawImage(source as any, 0, 0, targetW, targetH);
    } catch (e) {
      console.warn(`[TextureAtlas] downscale drawImage failed: ${e}`);
      return null;
    }
    return canvas as ImageSource;
  }

  /**
   * If `source` exceeds the atlas dimensions (after padding), produce
   * a downscaled copy that just fits; otherwise return the source as-is.
   * Caller treats the result as the effective upload source.
   *
   * Decoupled from {@link addTexture} so {@link canFitTexture} can use
   * the same target-dimension calculation without paying for the actual
   * canvas allocation — the probe just needs the *would-be* width and
   * height after downscale to drive its shelf-fit replay.
   */
  private _maybeDownscale(
    id: string,
    source: ImageSource,
    w: number,
    h: number
  ): { source: ImageSource; w: number; h: number; downscaled: boolean } {
    const maxFit = this._maxEntryDimension();
    if (w <= maxFit && h <= maxFit) {
      return { source, w, h, downscaled: false };
    }
    const scale = Math.min(maxFit / w, maxFit / h);
    const targetW = Math.max(1, Math.floor(w * scale));
    const targetH = Math.max(1, Math.floor(h * scale));
    const scaled = this._downscaleSource(source, targetW, targetH);
    if (!scaled) {
      // Environment can't downscale — keep original; the shelf-pack
      // will refuse it and the caller will fall through to sentinel
      // (preserving prior behaviour for non-DOM contexts).
      console.warn(
        `[TextureAtlas] '${id}' ${w}×${h} exceeds atlas size ${this.size} and downscaling is unavailable — falling back to sentinel`
      );
      return { source, w, h, downscaled: false };
    }
    console.warn(
      `[TextureAtlas] '${id}' ${w}×${h} exceeds atlas size ${this.size}; auto-downscaled to ${targetW}×${targetH} (${(scale * 100).toFixed(1)}% of original) — increase the atlas size in MemoryConfigs if you need full resolution`
    );
    return { source: scaled, w: targetW, h: targetH, downscaled: true };
  }

  /**
   * Returns the aspect-preserving downscale dimensions of a source of
   * size `(w, h)` if it would exceed the atlas size, or `(w, h)`
   * unchanged otherwise. Used by {@link canFitTexture} to compute the
   * fit-probe dimensions without materialising a canvas.
   */
  private _targetDimensions(w: number, h: number): { w: number; h: number } {
    const maxFit = this._maxEntryDimension();
    if (w <= maxFit && h <= maxFit) {
      return { w, h };
    }
    const scale = Math.min(maxFit / w, maxFit / h);
    return {
      w: Math.max(1, Math.floor(w * scale)),
      h: Math.max(1, Math.floor(h * scale))
    };
  }

  /**
   * Largest entry dimension that's guaranteed to shelf-pack into a
   * fresh atlas of `this.size`. Has to budget for:
   *   - the 4×4 sentinel block reserved at the top-left of every
   *     atlas (consumes a full-width shelf of height `4 + padding`);
   *   - the per-entry padding gutter applied during shelf-pack.
   *
   * Conservative on both axes so a square downscale guarantees both
   * dimensions clear at once.
   */
  private _maxEntryDimension(): number {
    // 4 (sentinel) + padding (sentinel's shelf trailing padding) +
    // 2 * padding (entry's leading + trailing gutter for symmetric
    // edge extrusion — see _extrudeWithGutter).
    return Math.max(1, this.size - 4 - 3 * this.padding);
  }

  /**
   * Build an extruded copy of `source` sized
   * `(w + 2 * padding) × (h + 2 * padding)`, with the source
   * centred at `(padding, padding)` and the surrounding gutter
   * filled with pixels that match the texture's wrap mode (one
   * 1-px slice per side stretched across the gutter, plus four
   * corner stamps). `RepeatWrapping` gutters are filled from the
   * opposite edge so mip generation preserves tile continuity.
   * Other wrap modes use the local edge, matching clamp semantics.
   *
   * Why extrude: each atlas entry has a CLAMP_TO_EDGE-style
   * border requirement so that bilinear filtering at the entry's
   * 0/1 UV edges, and `generateMipmap`'s box-filter at every
   * higher mip level, only ever read the entry's own colour —
   * never the sentinel fill or a neighbouring entry. Without
   * this, an albedo entry's right edge would average to the
   * neutral sentinel colour at higher mip levels, surfacing as a
   * bright halo seam on the rendered mesh at distance.
   *
   * Returns the original `source` when `padding === 0`, or `null`
   * in non-DOM contexts (Node tests, non-OffscreenCanvas workers).
   * Callers fall back to a no-gutter upload in the `null` case
   * — same behaviour as before this fix, just without the bleed
   * protection.
   */
  private _extrudeWithGutter(source: ImageSource, w: number, h: number, options: TextureAtlasUploadOptions = {}): ImageSource | null {
    const p = this.padding;
    if (p <= 0) return source;
    const ew = w + 2 * p;
    const eh = h + 2 * p;
    let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(ew, eh);
    } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const c = document.createElement("canvas");
      c.width = ew; c.height = eh;
      canvas = c;
    }
    if (!canvas) return null;
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) return null;
    // `imageSmoothingEnabled = false` so the per-slice extrusion
    // copies (1-px source slices stretched to p-px gutter) replicate
    // exactly without blending — bilinear scaling on a 1-px source
    // would just multiply that pixel by alpha, but the gutter has
    // to read the exact edge value at every sample to prevent any
    // bleed during mip generation.
    ctx.imageSmoothingEnabled = false;
    try {
      // Centre — entry's own pixels. The 2D-canvas drawImage spec
      // accepts CSSImageValue / HTMLCanvasElement / HTMLImageElement
      // / HTMLVideoElement / ImageBitmap / OffscreenCanvas /
      // SVGImageElement / VideoFrame — but NOT ImageData (raw
      // pixel buffer). texSubImage2D accepts ImageData natively so
      // it shows up here too; use putImageData when we get one.
      // Unknown source shapes (future texSubImage2D-accepted types
      // we don't recognise) fall through to the catch and the
      // caller swaps in the un-extruded upload path.
      if (typeof ImageData !== "undefined" && source instanceof ImageData) {
        ctx.putImageData(source, p, p);
      } else {
        ctx.drawImage(source as any, p, p, w, h);
      }
      const repeatS = options.wrapS === RepeatWrapping;
      const repeatT = options.wrapT === RepeatWrapping;
      const leftSourceX = repeatS ? p + w - 1 : p;
      const rightSourceX = repeatS ? p : p + w - 1;
      const topSourceY = repeatT ? p + h - 1 : p;
      const bottomSourceY = repeatT ? p : p + h - 1;

      // Edges — 1-px-wide source slices stretched across the gutter.
      ctx.drawImage(canvas as any, p,            topSourceY,    w, 1, p,     0,     w, p); // top
      ctx.drawImage(canvas as any, p,            bottomSourceY, w, 1, p,     p + h, w, p); // bottom
      ctx.drawImage(canvas as any, leftSourceX,  p,            1, h, 0,     p,     p, h); // left
      ctx.drawImage(canvas as any, rightSourceX, p,            1, h, p + w, p,     p, h); // right
      // Corners — 1-px corner samples stretched into p×p quadrants.
      ctx.drawImage(canvas as any, leftSourceX,  topSourceY,    1, 1, 0,     0,     p, p); // TL
      ctx.drawImage(canvas as any, rightSourceX, topSourceY,    1, 1, p + w, 0,     p, p); // TR
      ctx.drawImage(canvas as any, leftSourceX,  bottomSourceY, 1, 1, 0,     p + h, p, p); // BL
      ctx.drawImage(canvas as any, rightSourceX, bottomSourceY, 1, 1, p + w, p + h, p, p); // BR
    } catch (e) {
      // Anything else (an unknown source shape, a Worker context
      // where one of the calls isn't supported) — fall back silently
      // and let the caller upload the un-extruded source. Seams may
      // creep back at this entry's edges, but the texture loads.
      return null;
    }
    return canvas as ImageSource;
  }

  /**
   * Returns a copy whose low-alpha texel RGB has been filled from nearby
   * opaque texels. Used only for albedo atlas entries sampled by MASK-mode
   * materials.
   */
  private _sanitizeAlphaMaskedColorSource(source: ImageSource, w: number, h: number): ImageSource | null {
    if (typeof ImageData !== "undefined" && source instanceof ImageData) {
      return sanitizeAlphaMaskedColorImageData(source) as ImageSource;
    }
    return createSanitizedAlphaMaskedColorImageData(source, false, w, h) as ImageSource | null;
  }

  /**
   * Adds an image to the atlas — or returns the cached transform if `id`
   * is already present. Returns `null` if the atlas is full.
   *
   * Sources whose `width` or `height` (with padding) would exceed the
   * atlas dimensions are automatically downscaled to fit, with a
   * warn-level log. The renderer is built around continuous streaming
   * of varied content, so a too-big texture lands as a lower-res copy
   * with PBR detail intact rather than as a sentinel that would surface
   * as a visible material artefact.
   *
   * Caller must have called {@link allocate} first.
   */
  public addTexture(id: string, source: ImageSource, options: TextureAtlasUploadOptions = {}): AtlasTransform | null {
    if (!this.allocated || !this.texture) {
      return null;
    }
    const entryKey = this._getEntryKey(id, options);
    const cached = this._entries.get(entryKey);
    if (cached) {
      return { uOffset: cached.uOffset, vOffset: cached.vOffset, uScale: cached.uScale, vScale: cached.vScale };
    }
    if (source.width <= 0 || source.height <= 0) return null;

    const prepared = this._maybeDownscale(id, source, source.width, source.height);
    let uploadSource = prepared.source;
    const w = prepared.w;
    const h = prepared.h;

    const placed = this._shelfPack(w, h);
    if (!placed) return null;

    // Build an edge-extruded copy: original (w × h) centred inside
    // a (w + 2p) × (h + 2p) canvas, gutter ring filled with
    // replicated edge pixels. The shelf reserved the full
    // (w + 2p) × (h + 2p) block already; we upload the extruded
    // canvas starting `padding` to the up-left of the entry's
    // pixel rect so the gutter ring lands in the reserved area.
    // `null` return = environment can't extrude (no canvas); fall
    // back to the un-extruded upload at the entry's pixel rect.
    if (options.sanitizeAlphaMaskRGB === true) {
      uploadSource = this._sanitizeAlphaMaskedColorSource(uploadSource, w, h) ?? uploadSource;
    }
    const extruded = this._extrudeWithGutter(uploadSource, w, h, options);
    const uploadX = extruded ? placed.x - this.padding : placed.x;
    const uploadY = extruded ? placed.y - this.padding : placed.y;
    const finalUpload = extruded ?? uploadSource;

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    try {
      // texSubImage2D accepts HTMLImageElement, ImageBitmap, HTMLCanvasElement,
      // and OffscreenCanvas directly. SRGB8_ALPHA8 + UNSIGNED_BYTE means the
      // texels are decoded sRGB → linear at sample time.
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        uploadX,
        uploadY,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        finalUpload as any
      );
      // Defer the mip-pyramid refresh. {@link flushMipmaps} runs
      // before the next draw and pays one regeneration per atlas
      // per frame regardless of how many slice writes happened —
      // critical when a loader streams in hundreds of textures
      // across a few frames.
      if (this.mipmap) {
        this._mipsDirty = true;
      }
    } catch (e) {
      gl.bindTexture(gl.TEXTURE_2D, null);
      // The shelf entry is wasted but the atlas is otherwise intact.
      console.warn(`[TextureAtlas] texSubImage2D failed for id='${id}': ${e}`);
      return null;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);

    const transform: AtlasTransform = {
      uOffset: placed.x / this.size,
      vOffset: placed.y / this.size,
      uScale:  w / this.size,
      vScale:  h / this.size
    };
    this._entries.set(entryKey, {
      ...placed,
      id,
      width: w,
      height: h,
      source: uploadSource,
      sanitizeAlphaMaskRGB: options.sanitizeAlphaMaskRGB === true,
      wrapS: options.wrapS,
      wrapT: options.wrapT,
      ...transform
    });
    this.onUpdated.dispatch(this, undefined);
    return transform;
  }

  /**
   * Re-upload the pixels of an already-added texture, reusing its
   * cached sub-rect placement. Returns `true` if the entry exists
   * and the upload was issued, `false` otherwise (id not in this
   * atlas).
   *
   * Used by the post-finalize `onSceneTextureImageDataChanged` path,
   * when a caller has mutated a SceneTexture's `imageData` and wants
   * the GPU copy refreshed without rebuilding any meshes or
   * materials. The shelf-pack state is left untouched — the atlas
   * doesn't know whether the new pixel buffer's dimensions match the
   * cached placement, so it's the caller's responsibility to ensure
   * the source's `width`/`height` haven't changed.
   */
  public updateTexture(id: string, source: ImageSource): boolean {
    if (!this.allocated || !this.texture) {
      return false;
    }
    const matchingEntries = [...this._entries.values()].filter((entry) => entry.id === id);
    if (matchingEntries.length === 0) {
      return false;
    }
    // If the cached entry was downscaled at add time, the new source
    // needs to be drawn at the same target dimensions or we'd write
    // off the end of the cached sub-rect. Reuse the same downscale
    // helper — when the incoming dimensions already match the entry,
    // it's a no-op draw at native size.
    let updated = false;
    for (const entry of matchingEntries) {
      let uploadSource: ImageSource = source;
      if (source.width !== entry.width || source.height !== entry.height) {
        const scaled = this._downscaleSource(source, entry.width, entry.height);
        if (!scaled) {
          console.warn(
            `[TextureAtlas] updateTexture('${id}'): source ${source.width}×${source.height} does not match cached entry ${entry.width}×${entry.height} and downscaling is unavailable — refusing update`
          );
          continue;
        }
        uploadSource = scaled;
      }
      if (entry.sanitizeAlphaMaskRGB) {
        uploadSource = this._sanitizeAlphaMaskedColorSource(uploadSource, entry.width, entry.height) ?? uploadSource;
      }
      // Re-build the edge-extruded copy at the cached entry's size
      // so the gutter ring around the entry contains the NEW source's
      // edge pixels rather than the stale ones from the first add.
      const extruded = this._extrudeWithGutter(uploadSource, entry.width, entry.height, {
        sanitizeAlphaMaskRGB: entry.sanitizeAlphaMaskRGB,
        wrapS: entry.wrapS,
        wrapT: entry.wrapT
      });
      const uploadX = extruded ? entry.x - this.padding : entry.x;
      const uploadY = extruded ? entry.y - this.padding : entry.y;
      const finalUpload = extruded ?? uploadSource;

      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      try {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          uploadX,
          uploadY,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          finalUpload as any
        );
        // Same deferred-flush as `addTexture` — see comment there.
        if (this.mipmap) {
          this._mipsDirty = true;
        }
      } catch (e) {
        gl.bindTexture(gl.TEXTURE_2D, null);
        console.warn(`[TextureAtlas] updateTexture texSubImage2D failed for id='${id}': ${e}`);
        continue;
      }
      gl.bindTexture(gl.TEXTURE_2D, null);
      // Cache the new source for future `addTexture(id)` repeat-calls
      // (which return the cached transform without re-uploading).
      entry.source = uploadSource;
      updated = true;
    }
    if (updated) {
      this.onUpdated.dispatch(this, undefined);
    }
    return updated;
  }

  /**
   * Non-destructive shelf-pack probe — tells the batch router whether
   * a texture would land in this atlas (`"fits"`), would fit in a
   * fresh atlas of the same size but not this one (`"would-fit-in-fresh-atlas"`,
   * meaning "spawn a new batch"), or is too big for any atlas at all
   * (`"too-big"`, meaning the upload will hit the sentinel fallback —
   * spawning a new batch wouldn't help).
   *
   * Sources larger than the atlas dimensions are auto-downscaled by
   * {@link addTexture}, so this probe uses the *post-downscale*
   * dimensions for its shelf-fit replay — meaning `"too-big"` is now
   * essentially reserved for the degenerate `w <= 0 || h <= 0` case.
   * A oversize texture that triggers a downscale will still report
   * `"fits"` or `"would-fit-in-fresh-atlas"` based on the scaled-down
   * footprint, so the batch router doesn't pointlessly spawn a new
   * batch (which wouldn't have helped — the downscaled copy fits in
   * the current atlas just as well as in a fresh one).
   *
   * Already-cached entries (matched by `id`) always report `"fits"` so
   * a SceneTexture shared by multiple meshes doesn't keep triggering
   * batch overflow.
   */
  public canFitTexture(
    id: string,
    w: number,
    h: number,
    options: TextureAtlasUploadOptions = {}
  ): "fits" | "would-fit-in-fresh-atlas" | "too-big" {
    if (this._entries.has(this._getEntryKey(id, options))) {
      return "fits";
    }
    if (w <= 0 || h <= 0) {
      return "too-big";
    }
    const target = this._targetDimensions(w, h);
    const padW = target.w + 2 * this.padding;
    const padH = target.h + 2 * this.padding;
    if (padW > this.size || padH > this.size) {
      return "too-big";
    }
    // Replay shelf-pack without mutating state.
    for (const shelf of this._shelves) {
      if (shelf.height >= padH && shelf.usedWidth + padW <= this.size) {
        return "fits";
      }
    }
    const lastShelf = this._shelves[this._shelves.length - 1];
    const newY = lastShelf ? lastShelf.y + lastShelf.height : 0;
    if (newY + padH <= this.size) {
      return "fits";
    }
    return "would-fit-in-fresh-atlas";
  }

  /**
   * Looks up an already-added entry's transform. Useful for sharing one
   * SceneTexture across multiple meshes in a batch.
   */
  public getTransform(id: string, options: TextureAtlasUploadOptions = {}): AtlasTransform | null {
    const e = this._entries.get(this._getEntryKey(id, options));
    if (!e) return null;
    return { uOffset: e.uOffset, vOffset: e.vOffset, uScale: e.uScale, vScale: e.vScale };
  }

  /**
   * Re-creates the GPU texture after WebGL context loss and re-stamps the
   * sentinel and every previously-added image. Existing transforms remain
   * valid because the layout is identical.
   */
  public webglContextRestored(): SDKResult<void> {
    if (!this.allocated) {
      return this.allocate();
    }
    this.allocated = false;
    this.texture = null;
    const re = this.allocate();
    if (!re.ok) return re;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture!);
    // Re-stamp every entry exactly as addTexture/updateTexture do — same
    // edge-extruded gutter and UNPACK pixel-store state. The previous version
    // skipped both, so restored atlas slices were mis-aligned / un-flipped and
    // their gutters left at the sentinel colour, surfacing as wrong or missing
    // textures (and white samples blowing out HDR bloom).
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    for (const [entryKey, entry] of this._entries) {
      const extruded = this._extrudeWithGutter(entry.source, entry.width, entry.height, {
        sanitizeAlphaMaskRGB: entry.sanitizeAlphaMaskRGB,
        wrapS: entry.wrapS,
        wrapT: entry.wrapT
      });
      const uploadX = extruded ? entry.x - this.padding : entry.x;
      const uploadY = extruded ? entry.y - this.padding : entry.y;
      const finalUpload = extruded ?? entry.source;
      try {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          uploadX,
          uploadY,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          finalUpload as any
        );
      } catch (e) {
        console.warn(`[TextureAtlas] context-restore re-stamp failed for id='${entryKey}': ${e}`);
      }
    }
    // Mark dirty rather than regenerating directly. The next
    // `flushMipmaps` (called per draw) will pick it up. Same
    // deferred-flush model as `addTexture` / `updateTexture`,
    // which keeps the regeneration cost amortised whether the
    // dirtying came from a context restore or a live texture
    // burst.
    if (this.mipmap) {
      this._mipsDirty = true;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.onUpdated.dispatch(this, undefined);
    return { ok: true, value: undefined };
  }

  /**
   * If a mip-bearing atlas has level-0 writes pending since the
   * last flush, regenerate the pyramid and clear the dirty flag.
   * Cheap to call when the flag is `false` (one branch).
   *
   * Called by the renderer immediately before binding the atlas
   * for a draw so each atlas pays at most one regeneration per
   * frame regardless of how many slices were written since the
   * previous draw.
   */
  /**
   * @returns `true` when a mip pyramid was actually regenerated. Regeneration
   * binds/unbinds the atlas on the active texture unit, so the caller must
   * treat any per-unit bound-texture tracking as invalid afterwards.
   */
  public flushMipmaps(): boolean {
    if (!this._mipsDirty) return false;
    if (!this.mipmap || !this.allocated || !this.texture) {
      this._mipsDirty = false;
      return false;
    }
    this._regenerateMipmaps();
    this._mipsDirty = false;
    return true;
  }

  /** Frees the GPU texture and clears all CPU-side state. */
  public destroy(): void {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
    this.allocated = false;
    this._shelves.length = 0;
    this._entries.clear();
  }

  /** Bytes occupied by the texture on the GPU. */
  public getAllocatedBytes(): number {
    return this.allocated ? this.size * this.size * 4 : 0;
  }

  /** Bytes used by the actually-stamped sub-rects (best-effort). */
  public getUsedBytes(): number {
    let total = 4 * 4 * 4; // sentinel
    for (const e of this._entries.values()) {
      total += e.width * e.height * 4;
    }
    return total;
  }

  /**
   * Fills the entire level-0 atlas with {@link sentinelColor}.
   *
   * Implemented as a one-shot framebuffer clear — attach the atlas
   * as colour attachment 0, `gl.clear`, detach. Beats the obvious
   * `texSubImage2D(... new Uint8Array(size² × 4))` alternative on
   * memory (which would allocate ~64 MB temporarily for a 4096²
   * atlas) and on time (the GPU clear is essentially free).
   *
   * Restores the previous framebuffer binding and clear colour
   * before returning so callers don't see side effects on global
   * GL state.
   */
  private _fillSentinel(): void {
    const gl = this.gl;
    if (!this.texture) return;
    const fbo = gl.createFramebuffer();
    if (!fbo) return;

    const prevFbo = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    const prevClear = gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array;
    const prevColorMask = gl.getParameter(gl.COLOR_WRITEMASK) as boolean[];

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0
    );

    // Clear colour comes in as 0..255 bytes; GL wants 0..1 floats.
    // For sRGB atlases the GPU encodes the linear write to sRGB on
    // store automatically — `(1, 1, 1, 1)` linear → `(255, 255, 255, 255)`
    // bytes, which is what the sentinel stamp would write directly,
    // so the two paths agree.
    gl.clearColor(
      this.sentinelColor[0] / 255,
      this.sentinelColor[1] / 255,
      this.sentinelColor[2] / 255,
      this.sentinelColor[3] / 255,
    );
    gl.colorMask(true, true, true, true);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Restore.
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
    gl.deleteFramebuffer(fbo);
    gl.clearColor(prevClear[0], prevClear[1], prevClear[2], prevClear[3]);
    gl.colorMask(prevColorMask[0], prevColorMask[1], prevColorMask[2], prevColorMask[3]);
  }

  /**
   * Refreshes the mip pyramid from level-0.
   *
   * sRGB-encoded atlases (`SRGB8_ALPHA8`) take the shader-pass
   * path in {@link _generateSRGBMipmapsViaShader} because
   * `gl.generateMipmap` on an sRGB texture is not required by the
   * WebGL2 spec to box-filter in linear space — in practice
   * browsers average the raw sRGB bytes, which brightens mid-tones
   * at every mip level >0 and feeds the bloom / tonemap path with
   * too much energy on distant surfaces (the symptom this whole
   * dispatcher exists to fix). Linear atlases (`RGBA8` for MR /
   * normals / occlusion / emissive) have no gamma to mishandle, so
   * the cheap built-in path is correct.
   */
  private _regenerateMipmaps(): void {
    const gl = this.gl;
    if (!this.texture) return;
    if (this.internalFormat === gl.SRGB8_ALPHA8) {
      this._generateSRGBMipmapsViaShader();
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private _getEntryKey(id: string, options: TextureAtlasUploadOptions = {}): string {
    return options.sanitizeAlphaMaskRGB === true ? `${id}${ALPHA_MASK_RGB_ENTRY_SUFFIX}` : id;
  }

  /**
   * Gamma-correct mip-pyramid generation for the sRGB albedo
   * atlas.
   *
   * Each level i is rendered as a fullscreen-triangle pass that
   * samples level i-1 with `LINEAR` filtering. The sampler's view
   * of the texture is restricted to level i-1 via
   * `TEXTURE_BASE_LEVEL` / `TEXTURE_MAX_LEVEL` so the read and the
   * write target (level i, attached to the FBO) refer to disjoint
   * mip levels of the same texture — that's what the GLES 3.0
   * feedback-loop rule needs to be satisfied. The format is
   * `SRGB8_ALPHA8` on both ends of the pipe, so the GPU decodes
   * the source samples to linear on read and re-encodes the
   * shader's output to sRGB on store; the actual box-average
   * happens in linear space inside the bilinear hardware.
   *
   * State touched and restored: current framebuffer, current
   * program, VAO binding, active texture unit + its `TEXTURE_2D`
   * binding, viewport, color mask, and the BLEND / DEPTH_TEST /
   * CULL_FACE / SCISSOR_TEST / STENCIL_TEST capability bits. The
   * atlas's own `TEXTURE_BASE_LEVEL` / `TEXTURE_MAX_LEVEL` /
   * `TEXTURE_MIN_FILTER` are also reset to the values
   * {@link allocate} configured.
   */
  private _generateSRGBMipmapsViaShader(): void {
    const gl = this.gl;
    if (!this.texture) return;

    const res = TextureAtlas._getMipPassResources(gl);
    if (!res) {
      // Couldn't compile the pass — fall back to the gamma-wrong
      // built-in so the atlas at least samples *something* at
      // distance instead of undefined level-N contents. Worse
      // visual quality but better than a broken viewer.
      console.warn(`[TextureAtlas] sRGB mip shader pass unavailable on '${this._description}' — falling back to gl.generateMipmap (gamma-incorrect).`);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return;
    }

    const mipLevels = this._mipLevels;

    // Snapshot every piece of GL state the pass touches. The
    // renderer's per-draw bind path doesn't reset all of these
    // unconditionally, so leaving any in a hijacked state would
    // break subsequent draws.
    const prevFbo = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    const prevVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    const prevViewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
    const prevActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
    const prevColorMask = gl.getParameter(gl.COLOR_WRITEMASK) as boolean[];
    const prevBlend = gl.isEnabled(gl.BLEND);
    const prevDepthTest = gl.isEnabled(gl.DEPTH_TEST);
    const prevCullFace = gl.isEnabled(gl.CULL_FACE);
    const prevScissorTest = gl.isEnabled(gl.SCISSOR_TEST);
    const prevStencilTest = gl.isEnabled(gl.STENCIL_TEST);

    gl.activeTexture(gl.TEXTURE0);
    const prevTextureUnit0 = gl.getParameter(gl.TEXTURE_BINDING_2D);

    gl.bindFramebuffer(gl.FRAMEBUFFER, res.fbo);
    gl.useProgram(res.program);
    gl.bindVertexArray(res.vao);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(res.uSrc, 0);

    if (prevBlend) gl.disable(gl.BLEND);
    if (prevDepthTest) gl.disable(gl.DEPTH_TEST);
    if (prevCullFace) gl.disable(gl.CULL_FACE);
    if (prevScissorTest) gl.disable(gl.SCISSOR_TEST);
    if (prevStencilTest) gl.disable(gl.STENCIL_TEST);
    gl.colorMask(true, true, true, true);

    // Single-level sampling during the pass — the BASE/MAX_LEVEL
    // window below picks which level that is per iteration.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    for (let i = 1; i < mipLevels; i++) {
      const srcLevel = i - 1;
      const dstSize = this.size >> i;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, srcLevel);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, srcLevel);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, i);
      gl.viewport(0, 0, dstSize, dstSize);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Restore the texture-side parameters to what allocate() set.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, this._maxSampleMipLevel);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    // Detach the atlas from the cached FBO so it isn't keeping a
    // reference in slot 0 between regenerations.
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);

    gl.bindTexture(gl.TEXTURE_2D, prevTextureUnit0);
    gl.activeTexture(prevActiveTexture);
    gl.bindVertexArray(prevVao);
    gl.useProgram(prevProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
    gl.colorMask(prevColorMask[0], prevColorMask[1], prevColorMask[2], prevColorMask[3]);
    if (prevBlend) gl.enable(gl.BLEND);
    if (prevDepthTest) gl.enable(gl.DEPTH_TEST);
    if (prevCullFace) gl.enable(gl.CULL_FACE);
    if (prevScissorTest) gl.enable(gl.SCISSOR_TEST);
    if (prevStencilTest) gl.enable(gl.STENCIL_TEST);
  }

  /**
   * Returns the cached {@link MipPassResources} for `gl`, compiling
   * and caching them on first use. If a previous attempt failed,
   * the cache stores `null` and we return that without retrying.
   * If the context was lost and restored since the last call, the
   * `gl.isProgram` check picks up the now-invalid handle and a
   * fresh set is built.
   */
  private static _getMipPassResources(gl: WebGL2RenderingContext): MipPassResources | null {
    const cached = TextureAtlas._mipPassCache.get(gl);
    if (cached === null) return null;
    if (cached && gl.isProgram(cached.program)) return cached;

    const vsSource = `#version 300 es
out vec2 vUV;
void main() {
  // Three-vertex fullscreen triangle. The two-bit pattern across
  // gl_VertexID = 0,1,2 puts the corners at (-1,-1), (3,-1), (-1,3)
  // in clip space — the triangle covers the [-1,1]^2 viewport with
  // a single primitive, and vUV interpolates over [0,2]^2 with the
  // [0,1]^2 region landing inside the viewport.
  vec2 pos = vec2(
    float((gl_VertexID & 1) << 2) - 1.0,
    float((gl_VertexID & 2) << 1) - 1.0
  );
  vUV = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;
    const fsSource = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
out vec4 outColor;
void main() {
  // The atlas's BASE_LEVEL window restricts this sampler to a
  // single source mip; bilinear filtering at the half-resolution
  // viewport returns the 2x2 box average. For an SRGB8_ALPHA8
  // texture the read decodes to linear and the write encodes to
  // sRGB — the average happens in linear space, which is the
  // entire point of routing albedo through here.
  outColor = texture(uSrc, vUV);
}
`;
    const program = TextureAtlas._compileMipProgram(gl, vsSource, fsSource);
    if (!program) {
      TextureAtlas._mipPassCache.set(gl, null);
      return null;
    }
    const vao = gl.createVertexArray();
    const fbo = gl.createFramebuffer();
    const uSrc = gl.getUniformLocation(program, "uSrc");
    if (!vao || !fbo || !uSrc) {
      gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      if (fbo) gl.deleteFramebuffer(fbo);
      TextureAtlas._mipPassCache.set(gl, null);
      return null;
    }
    const res: MipPassResources = { program, vao, fbo, uSrc };
    TextureAtlas._mipPassCache.set(gl, res);
    return res;
  }

  /**
   * Compiles and links the mip-pass program. Returns `null` on
   * any failure and logs the offending stage's info log; callers
   * fall back to {@link gl.generateMipmap}.
   */
  private static _compileMipProgram(
    gl: WebGL2RenderingContext,
    vsSource: string,
    fsSource: string
  ): WebGLProgram | null {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return null;
    }
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error(`[TextureAtlas] mip-pass VS compile: ${gl.getShaderInfoLog(vs)}`);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return null;
    }
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error(`[TextureAtlas] mip-pass FS compile: ${gl.getShaderInfoLog(fs)}`);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return null;
    }
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return null;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(`[TextureAtlas] mip-pass link: ${gl.getProgramInfoLog(program)}`);
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  /**
   * Stamps a 4×4 sentinel block at (0, 0) using {@link sentinelColor}.
   * Untextured meshes sample this block via their zero-scale UV
   * transform — the colour determines what "no texture" decodes to in
   * the BRDF (white for multiplicative atlases, neutral-tangent for
   * normal-map atlases).
   */
  private _stampSentinel(): void {
    const gl = this.gl;
    const px = new Uint8Array(4 * 4 * 4);
    const [r, g, b, a] = this.sentinelColor;
    for (let i = 0; i < 16; i++) {
      px[i * 4 + 0] = r;
      px[i * 4 + 1] = g;
      px[i * 4 + 2] = b;
      px[i * 4 + 3] = a;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, px);
  }

  /**
   * Shelf bin-packing. Tries every existing shelf for a fit; if none fit,
   * opens a new shelf below the existing ones provided there's atlas
   * height left. Returns `null` on overflow.
   */
  private _shelfPack(w: number, h: number): { x: number, y: number } | null {
    // Reserve symmetric leading + trailing padding around every
    // entry so {@link _extrudeWithGutter} can fill the gutter on
    // all four sides with replicated edge pixels. The returned
    // position is the entry's own pixel rect — the extruded
    // upload writes to (returned.x - padding, returned.y - padding)
    // covering the full reserved block.
    const p = this.padding;
    const blockW = w + 2 * p;
    const blockH = h + 2 * p;
    if (blockW > this.size || blockH > this.size) return null;

    for (const shelf of this._shelves) {
      if (shelf.height >= blockH && shelf.usedWidth + blockW <= this.size) {
        const blockX = shelf.usedWidth;
        const blockY = shelf.y;
        shelf.usedWidth += blockW;
        return { x: blockX + p, y: blockY + p };
      }
    }

    const lastShelf = this._shelves[this._shelves.length - 1];
    const newY = lastShelf ? lastShelf.y + lastShelf.height : 0;
    if (newY + blockH > this.size) return null;

    this._shelves.push({ y: newY, height: blockH, usedWidth: blockW });
    return { x: p, y: newY + p };
  }

  /**
   * Rebinds this wrapper to a restored WebGL context before reallocating its
   * atlas texture.
   * @internal
   */
  public setWebGLContext(gl: WebGL2RenderingContext): void {
    this.gl = gl;
  }
}
