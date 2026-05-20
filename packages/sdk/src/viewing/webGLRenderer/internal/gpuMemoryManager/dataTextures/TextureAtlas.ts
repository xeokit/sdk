import {EventEmitter, SDKErrorType, type SDKResult} from "../../../../../base/core";
import {EventDispatcher} from "strongly-typed-events";

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

export type ImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

interface Shelf {
  /** Top edge of this shelf, in atlas pixels. */
  y: number;
  /** Height of the shelf — the tallest texture it holds, including padding. */
  height: number;
  /** Width consumed so far (next free x). */
  usedWidth: number;
}

interface AtlasEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  source: ImageSource;
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
   * levels — `8` covers entries down to ~16-pixel level-0 sizes
   * cleanly. Larger entries waste a small fraction of the atlas;
   * smaller entries (~tens of pixels) might still bleed at the
   * tiniest mips, which is acceptable for first-cut Phase 1.
   */
  public static readonly DEFAULT_PADDING_MIPMAP = 8;

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
   * `true` when the atlas was allocated with a full mip pyramid
   * (`floor(log2(size)) + 1` levels) and is sampled trilinearly.
   * Set from the constructor option; `false` keeps the cheap
   * single-level path.
   */
  public mipmap: boolean = false;

  /**
   * Set by `addTexture` / `updateTexture` when a level-0 write
   * has happened since the last `gl.generateMipmap`; cleared by
   * {@link flushMipmaps}. Lets the atlas batch many level-0
   * mutations and pay one full-pyramid regeneration per draw
   * instead of N regenerations during the burst.
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
     * Allocate the atlas with a full mip pyramid and sample
     * trilinearly. Default `false`. When `true`, every successful
     * `addTexture` triggers `gl.generateMipmap` to refresh the
     * pyramid for the entire atlas — fine when textures upload
     * once at load, scales with atlas size as more textures
     * stream in.
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
      // bilinear otherwise (single-level filtered sample).
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        this.mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Internal format dictates whether the GPU sRGB-decodes on sample.
      // Albedo uses SRGB8_ALPHA8 (sRGB-encoded source → linear sample);
      // MR / normals / occlusion use RGBA8 (linear all the way).
      const mipLevels = this.mipmap
        ? (Math.floor(Math.log2(this.size)) + 1)
        : 1;
      gl.texStorage2D(gl.TEXTURE_2D, mipLevels, this.internalFormat, this.size, this.size);
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
      // colour). `generateMipmap` propagates that to levels 1..N so a
      // sentinel sample at any mip level returns the same colour, and
      // untextured meshes look identical regardless of mip mode.
      if (this.mipmap) {
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      gl.bindTexture(gl.TEXTURE_2D, null);
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
    // 4 (sentinel) + padding (sentinel's shelf padding) + padding (entry's own gutter)
    return Math.max(1, this.size - 4 - 2 * this.padding);
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
  public addTexture(id: string, source: ImageSource): AtlasTransform | null {
    if (!this.allocated || !this.texture) {
      return null;
    }
    const cached = this._entries.get(id);
    if (cached) {
      return { uOffset: cached.uOffset, vOffset: cached.vOffset, uScale: cached.uScale, vScale: cached.vScale };
    }
    if (source.width <= 0 || source.height <= 0) return null;

    const prepared = this._maybeDownscale(id, source, source.width, source.height);
    const uploadSource = prepared.source;
    const w = prepared.w;
    const h = prepared.h;

    const placed = this._shelfPack(w, h);
    if (!placed) return null;

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
        placed.x,
        placed.y,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        uploadSource as any
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
    this._entries.set(id, { ...placed, width: w, height: h, source: uploadSource, ...transform });
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
    const entry = this._entries.get(id);
    if (!entry) {
      return false;
    }
    // If the cached entry was downscaled at add time, the new source
    // needs to be drawn at the same target dimensions or we'd write
    // off the end of the cached sub-rect. Reuse the same downscale
    // helper — when the incoming dimensions already match the entry,
    // it's a no-op draw at native size.
    let uploadSource: ImageSource = source;
    if (source.width !== entry.width || source.height !== entry.height) {
      const scaled = this._downscaleSource(source, entry.width, entry.height);
      if (!scaled) {
        console.warn(
          `[TextureAtlas] updateTexture('${id}'): source ${source.width}×${source.height} does not match cached entry ${entry.width}×${entry.height} and downscaling is unavailable — refusing update`
        );
        return false;
      }
      uploadSource = scaled;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    try {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        entry.x,
        entry.y,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        uploadSource as any
      );
      // Same deferred-flush as `addTexture` — see comment there.
      if (this.mipmap) {
        this._mipsDirty = true;
      }
    } catch (e) {
      gl.bindTexture(gl.TEXTURE_2D, null);
      console.warn(`[TextureAtlas] updateTexture texSubImage2D failed for id='${id}': ${e}`);
      return false;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    // Cache the new source for future `addTexture(id)` repeat-calls
    // (which return the cached transform without re-uploading).
    entry.source = uploadSource;
    this.onUpdated.dispatch(this, undefined);
    return true;
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
  public canFitTexture(id: string, w: number, h: number): "fits" | "would-fit-in-fresh-atlas" | "too-big" {
    if (this._entries.has(id)) {
      return "fits";
    }
    if (w <= 0 || h <= 0) {
      return "too-big";
    }
    const target = this._targetDimensions(w, h);
    const padW = target.w + this.padding;
    const padH = target.h + this.padding;
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
  public getTransform(id: string): AtlasTransform | null {
    const e = this._entries.get(id);
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
    for (const entry of this._entries.values()) {
      try {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          entry.x,
          entry.y,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          entry.source as any
        );
      } catch (e) {
        console.warn(`[TextureAtlas] context-restore re-stamp failed: ${e}`);
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
   * for a draw so each atlas pays at most one
   * `gl.generateMipmap` per frame regardless of how many slices
   * were written since the previous draw.
   */
  public flushMipmaps(): void {
    if (!this._mipsDirty) return;
    if (!this.mipmap || !this.allocated || !this.texture) {
      this._mipsDirty = false;
      return;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._mipsDirty = false;
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
    const padW = w + this.padding;
    const padH = h + this.padding;
    if (padW > this.size || padH > this.size) return null;

    // Try existing shelves first — fits when shelf has enough height
    // headroom and free width for the padded entry.
    for (const shelf of this._shelves) {
      if (shelf.height >= padH && shelf.usedWidth + padW <= this.size) {
        const x = shelf.usedWidth;
        const y = shelf.y;
        shelf.usedWidth += padW;
        return { x, y };
      }
    }

    // Open a new shelf at the bottom if there's vertical room.
    const lastShelf = this._shelves[this._shelves.length - 1];
    const newY = lastShelf ? lastShelf.y + lastShelf.height : 0;
    if (newY + padH > this.size) return null;

    this._shelves.push({ y: newY, height: padH, usedWidth: padW });
    return { x: 0, y: newY };
  }
}
