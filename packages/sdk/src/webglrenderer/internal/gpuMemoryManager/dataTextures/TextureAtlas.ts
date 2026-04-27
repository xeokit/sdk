import {EventEmitter, SDKErrorType, type SDKResult} from "../../../../core";
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

type ImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

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
  }) {
    this.gl = options.gl;
    this._description = options.description;
    this.size = options.size ?? TextureAtlas.DEFAULT_SIZE;
    this.padding = options.padding ?? TextureAtlas.DEFAULT_PADDING;
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Internal format dictates whether the GPU sRGB-decodes on sample.
      // Albedo uses SRGB8_ALPHA8 (sRGB-encoded source → linear sample);
      // MR / normals / occlusion use RGBA8 (linear all the way).
      gl.texStorage2D(gl.TEXTURE_2D, 1, this.internalFormat, this.size, this.size);
      this._stampSentinel();
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
   * Adds an image to the atlas — or returns the cached transform if `id`
   * is already present. Returns `null` if the atlas is full.
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
    const w = source.width;
    const h = source.height;
    if (w <= 0 || h <= 0) return null;

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
        source as any
      );
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
    this._entries.set(id, { ...placed, width: w, height: h, source, ...transform });
    this.onUpdated.dispatch(this, undefined);
    return transform;
  }

  /**
   * Non-destructive shelf-pack probe — tells the batch router whether
   * a texture would land in this atlas (`"fits"`), would fit in a
   * fresh atlas of the same size but not this one (`"would-fit-in-fresh-atlas"`,
   * meaning "spawn a new batch"), or is too big for any atlas at all
   * (`"too-big"`, meaning the upload will hit the sentinel fallback —
   * spawning a new batch wouldn't help).
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
    const padW = w + this.padding;
    const padH = h + this.padding;
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
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.onUpdated.dispatch(this, undefined);
    return { ok: true, value: undefined };
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
