// DTXPointerTable.ts  (RGBA8UI version)

export interface DTXPointerTableOptions {
  gl: WebGL2RenderingContext;
  /** Number of 32-bit entries (one texel per entry). */
  capacity: number;
  /** Optional override; defaults to 4096 (clamped to MAX_TEXTURE_SIZE). */
  texWidth?: number;
}

/** Handle to an allocated portion. */
export interface DTXPointerTableHandle {
  id: number;
  base: number; // starting index in the lookup table
}

/** Internal free/used segment. */
interface Portion {
  base: number;
  size: number;
}

/**
 * DTXPointerTable
 * ---------
 * GPU-backed array of 32-bit unsigned integers stored in an RGBA8UI texture.
 * Each element is exactly one texel (RGBA_INTEGER / UNSIGNED_BYTE).
 * Value layout: R=bits 0..7, G=8..15, B=16..23, A=24..31.
 *
 * Typical usage: store linear addresses that point into another data texture
 * (e.g., 4096-wide tables), and fetch them in GLSL with `texelFetch`.
 *
 * - setItem / setPortionData / fillPortion
 * - getPortion / putPortion, with packing (defrag) when needed
 * - flush() only uploads dirty regions (coalesced per row)
 */
export class DTXPointerTable {
  readonly texture: WebGLTexture;
  readonly capacity: number;

  /** One uint32 logical value per texel (CPU-side logical buffer). */
  public buffer: Uint32Array<any>;

  private _gl: WebGL2RenderingContext;
  private _texWidth: number;
  private _texHeight: number;

  // allocation state
  private _free: Portion[] = [];
  private _used: Map<number, Portion> = new Map();
  private _handles: Map<number, DTXPointerTableHandle> = new Map();
  private _onMove: Map<number, (newBase: number) => void> = new Map();
  private _nextId = 1;

  // upload bookkeeping
  private _dirtyPortions: Set<number> = new Set();
  private _uploadAllOnFlush = false;

  // scratch encoder buffer for row uploads (bytes)
  private _scratchBytes: Uint8Array<any> = new Uint8Array(0);

  constructor(opts: DTXPointerTableOptions) {
    const gl = opts.gl;
    this._gl = gl;
    this.capacity = opts.capacity | 0;

    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0;
    this._texWidth = Math.min(Math.max(1, (opts.texWidth ?? 4096) | 0), maxSize);
    this._texHeight = Math.max(1, Math.ceil(this.capacity / this._texWidth));

    // Logical CPU buffer is one uint per texel (capacity rounded up to texture area)
    const totalTexels = this._texWidth * this._texHeight;
    this.buffer = new Uint32Array(totalTexels);

    // Create RGBA8UI texture
    const tex = gl.createTexture();
    if (!tex) throw new Error("DTXPointerTable: gl.createTexture() failed");
    this.texture = tex;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // Allocate texture storage (zeros). Using texImage2D for compatibility.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8UI,        // internal format (unsigned normalized integers, 8-bit each)
      this._texWidth,
      this._texHeight,
      0,
      gl.RGBA_INTEGER,   // format for integer textures
      gl.UNSIGNED_BYTE,  // type
      null
    );

    gl.bindTexture(gl.TEXTURE_2D, null);

    // Entire range is initially free
    this._free.push({ base: 0, size: this.capacity });
  }

  /** Texture width (in texels). */
  get texWidth(): number { return this._texWidth; }
  /** Texture height (in texels). */
  get texHeight(): number { return this._texHeight; }

  // ---------------- Allocation API ----------------

  getPortion(size: number, onMove?: (newBase: number) => void): DTXPointerTableHandle {
    if (size <= 0) throw new Error("DTXPointerTable.getPortion: size must be > 0");
    let idx = this._findFree(size);
    if (idx === -1) {
      this._pack();
      idx = this._findFree(size);
      if (idx === -1) throw new Error(`DTXPointerTable: allocation failed for size=${size}`);
    }
    return this._allocAtFreeIndex(idx, size, onMove);
  }

  putPortion(handle: DTXPointerTableHandle): void {
    const portion = this._used.get(handle.id);
    if (!portion) return;

    this._used.delete(handle.id);
    this._handles.delete(handle.id);
    this._onMove.delete(handle.id);

    this._insertFreeSorted(portion);
    this._coalesceFree();
  }

  /** Get a typed view into a portion (Uint32Array view). */
  getPortionView(handle: DTXPointerTableHandle): Uint32Array<any> {
    const portion = this._used.get(handle.id);
    if (!portion) throw new Error("DTXPointerTable.getPortionView: invalid handle");
    return this.buffer.subarray(portion.base, portion.base + portion.size);
  }

  // ---------------- Data writes ----------------

  setItem(index: number, value: number): void {
    this._assertIndex(index);
    this.buffer[index] = value >>> 0;
    const id = this._markSyntheticDirty(index, 1);
    this._dirtyPortions.add(id);
  }

  setPortionData(handle: DTXPointerTableHandle, values: ArrayLike<number>): void {
    const portion = this._used.get(handle.id);
    if (!portion) throw new Error("DTXPointerTable.setPortionData: invalid handle");
    if (values.length !== portion.size) {
      throw new Error(`DTXPointerTable.setPortionData: expected ${portion.size}, got ${values.length}`);
    }
    const base = portion.base;
    for (let i = 0; i < portion.size; i++) {
      this.buffer[base + i] = (values[i] >>> 0);
    }
    this._dirtyPortions.add(handle.id);
  }

  fillPortion(handle: DTXPointerTableHandle, value: number): void {
    const portion = this._used.get(handle.id);
    if (!portion) throw new Error("DTXPointerTable.fillPortion: invalid handle");
    this.buffer.fill((value >>> 0), portion.base, portion.base + portion.size);
    this._dirtyPortions.add(handle.id);
  }

  // ---------------- GPU upload ----------------

  /**
   * Uploads all dirty regions (coalesced per row) or entire buffer after a pack().
   * Note: This unbinds the texture when done. If your render path samples this
   * texture immediately after, re-bind it to the intended unit.
   */
  flush(): void {

    this.buffer.set(
[
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
]
);
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const bytes = this._encodeRangeToScratch(0, 6*36);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      6*36,
      1,
      gl.RGBA_INTEGER, gl.UNSIGNED_BYTE,
      bytes
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  return;

    if (this._uploadAllOnFlush) {
      // Encode whole buffer row by row to avoid huge temp allocations
      const itemsPerRow = this._texWidth;
      for (let y = 0; y < this._texHeight; y++) {
        const base = y * itemsPerRow;
        const count = Math.min(itemsPerRow, this.buffer.length - base);
        if (count <= 0) break;
        const bytes = this._encodeRangeToScratch(base, count);
        gl.texSubImage2D(
          gl.TEXTURE_2D, 0,
          0, y,
          count, 1,
          gl.RGBA_INTEGER, gl.UNSIGNED_BYTE,
          bytes
        );
      }
      this._dirtyPortions.clear();
      this._uploadAllOnFlush = false;
      gl.bindTexture(gl.TEXTURE_2D, null);
      return;
    }

    // Gather segments to upload
    const itemsPerRow = this._texWidth;
    type Seg = { base: number; size: number; };
    const segs: Seg[] = [];

    for (const id of this._dirtyPortions) {
      const portion = this._used.get(id);
      if (portion) segs.push({ base: portion.base, size: portion.size });
    }
    this._dirtyPortions.clear();

    // Sort & coalesce adjacent segments
    segs.sort((a, b) => a.base - b.base);
    const coalesced: Seg[] = [];
    for (const s of segs) {
      const last = coalesced[coalesced.length - 1];
      if (last && (last.base + last.size) === s.base) {
        last.size += s.size;
      } else {
        coalesced.push({ base: s.base, size: s.size });
      }
    }

    // Upload row-split chunks
    for (const seg of coalesced) {
      let base = seg.base;
      let remaining = seg.size;
      while (remaining > 0) {
        const x = base % itemsPerRow;
        const y = (base / itemsPerRow) | 0;
        const count = Math.min(remaining, itemsPerRow - x);

        const bytes = this._encodeRangeToScratch(base, count);
        gl.texSubImage2D(
          gl.TEXTURE_2D, 0,
          x, y,
          count, 1,
          gl.RGBA_INTEGER, gl.UNSIGNED_BYTE,
          bytes
        );
        base += count;
        remaining -= count;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Destroy GL resources. */
  destroy(): void {
    this._gl.deleteTexture(this.texture);
  }

  // ---------------- Helpers ----------------

  /** Encode (x,y) → linear address for a 2D table with known width. */
  static encodeAddress(x: number, y: number, width: number): number {
    return ((y | 0) * (width | 0) + (x | 0)) >>> 0;
  }

  /** Decode linear address → (x,y) for a given width. */
  static decodeAddress(addr: number, width: number): { x: number; y: number } {
    const a = addr >>> 0;
    const w = width | 0;
    return { x: (a % w) | 0, y: (a / w) | 0 };
  }

  // GLSL helpers (drop into your shader):
  //
  // ivec2 dtxAddrToUV(uint addr, uint texWidth) {
  //   return ivec2(int(addr % texWidth), int(addr / texWidth));
  // }
  // uint dtxLookup(usampler2D lookupTex, uint index) {
  //   int texW = textureSize(lookupTex, 0).x;
  //   ivec2 uv = ivec2(int(index % uint(texW)), int(index / uint(texW)));
  //   uvec4 px = texelFetch(lookupTex, uv, 0);
  //   return (px.r) | (px.g << 8) | (px.b << 16) | (px.a << 24);
  // }

  // ---------------- Internals ----------------

  private _assertIndex(i: number) {
    if (i < 0 || i >= this.capacity) {
      throw new RangeError(`DTXPointerTable: index ${i} out of range [0, ${this.capacity})`);
    }
  }

  private _findFree(size: number): number {
    return this._free.findIndex(b => b.size >= size);
  }

  private _allocAtFreeIndex(idx: number, size: number, onMove?: (newBase: number) => void): DTXPointerTableHandle {
    const block = this._free[idx];
    const id = this._nextId++;
    const portion: Portion = { base: block.base, size };
    this._used.set(id, portion);

    if (size === block.size) {
      this._free.splice(idx, 1);
    } else {
      block.base += size;
      block.size -= size;
    }

    const handle: DTXPointerTableHandle = { id, base: portion.base };
    this._handles.set(id, handle);
    if (onMove) this._onMove.set(id, onMove);
    return handle;
  }

  private _insertFreeSorted(p: Portion): void {
    let i = 0;
    while (i < this._free.length && this._free[i].base < p.base) i++;
    this._free.splice(i, 0, p);
  }

  private _coalesceFree(): void {
    for (let i = 0; i < this._free.length - 1;) {
      const a = this._free[i];
      const b = this._free[i + 1];
      if (a.base + a.size === b.base) {
        a.size += b.size;
        this._free.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  }

  private _pack(): void {
    // Move used portions to eliminate gaps; copyWithin on Uint32Array.
    const sorted = Array.from(this._used.entries()).sort(([, A], [, B]) => A.base - B.base);
    let writeHead = 0;
    const newUsed = new Map<number, Portion>();

    for (const [id, portion] of sorted) {
      if (portion.base !== writeHead) {
        const from = portion.base;
        const to = writeHead;
        const count = portion.size;

        this.buffer.copyWithin(to, from, from + count);

        const cb = this._onMove.get(id);
        if (cb) cb(to);

        const handle = this._handles.get(id);
        if (handle) handle.base = to;

        this._uploadAllOnFlush = true; // easiest: upload whole buffer post-pack
      }
      newUsed.set(id, { base: writeHead, size: portion.size });
      writeHead += portion.size;
    }

    this._used = newUsed;
    this._free = writeHead < this.capacity ? [{ base: writeHead, size: this.capacity - writeHead }] : [];
  }

  /**
   * Create a synthetic one-portion entry for setItem uploads.
   * We don't keep these between frames; they only exist for the next flush().
   */
  private _markSyntheticDirty(base: number, size: number): number {
    const id = this._nextId++;
    this._used.set(id, { base, size });
    // No handle/onMove created for synthetic portions
    return id;
  }

  // ---- encoding helpers ----

  /** Ensures _scratchBytes length ≥ count*4, returns a view sized to exactly count*4 bytes. */
  private _encodeRangeToScratch(startIndex: number, count: number): Uint8Array<any> {
    const byteLen = count * 4;
    if (this._scratchBytes.length < byteLen) {
      // grow with some headroom to reduce reallocs
      const newSize = Math.max(byteLen, Math.ceil(byteLen * 1.5));
      this._scratchBytes = new Uint8Array(newSize);
    }
    const out = this._scratchBytes.subarray(0, byteLen);

    let o = 0;
    const buf = this.buffer;
    for (let i = 0; i < count; i++) {
      const v = buf[startIndex + i] >>> 0;
      // Little-endian mapping to RGBA: R=LSB ... A=MSB
      out[o + 0] = v & 0xFF;
      out[o + 1] = (v >>> 8) & 0xFF;
      out[o + 2] = (v >>> 16) & 0xFF;
      out[o + 3] = (v >>> 24) & 0xFF;
      o += 4;
    }
    return out;
  }
}
