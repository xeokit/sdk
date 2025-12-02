// DTXPointerArray.ts

export interface DTXPointerArrayOptions {
  gl: WebGL2RenderingContext;
  /** Number of 32-bit entries (one texel per entry). */
  capacity: number;
  /** Optional override; defaults to 4096 (clamped to MAX_TEXTURE_SIZE). */
  texWidth?: number;
}

/** Handle to an allocated portion. */
export interface DTXPointerArrayHandle {
  id: number;
  base: number; // starting index in the lookup table
}

/** Internal free/used segment. */
interface Portion {
  base: number;
  size: number;
}

/**
 * DTXPointerArray
 * ---------
 * GPU-backed array of 32-bit unsigned integers stored in an R32UI texture.
 * Each element is exactly one texel (RED_INTEGER / UNSIGNED_INT).
 *
 * Typical usage: store linear addresses that point into another data texture
 * (e.g., 4096-wide tables), and fetch them in GLSL with `texelFetch`.
 *
 * - setItem / setPortionData / fillPortion
 * - getPortion / putPortion, with packing (defrag) when needed
 * - uploadChanges() only uploads dirty regions (coalesced per row)
 */
export class DTXPointerArray {
  texture: WebGLTexture;
  readonly capacity: number;

  /** One uint per texel. */
  public buffer: Uint32Array<any>;

  private _gl: WebGL2RenderingContext;
  private _texWidth: number;
  private _texHeight: number;

  // allocation state
  private _free: Portion[] = [];
  private _used: Map<number, Portion> = new Map();
  private _handles: Map<number, DTXPointerArrayHandle> = new Map();
  private _onMove: Map<number, (newBase: number) => void> = new Map();
  private _nextId = 1;

  // upload bookkeeping
  private _dirtyPortions: Set<number> = new Set();
  private _uploadAllOnFlush = false;

  private _numUsedElements = 0;

  private _packed: boolean = true;

  constructor(opts: DTXPointerArrayOptions) {
    this._gl = opts.gl;
    this.capacity = opts.capacity | 0;
    this._texWidth = 4096;
    this._texHeight = Math.max(1, Math.ceil(this.capacity / this._texWidth));
  }

  static get elementSizeInBytes(): number {
    return 4; // one uint32 per entry
  }

  /**
   * Gets the total capacity in bytes of the pointer array.
   */
  getCapacityBytes(): number {
    return this.capacity * DTXPointerArray.elementSizeInBytes;
  }

  /**
   * Gets the used bytes in the pointer array.
   */
  getUsedBytes() {
    return this._numUsedElements * DTXPointerArray.elementSizeInBytes;
  }

  allocate(): boolean {
    // Allocate CPU buffer to full texture area (padding at end is harmless)
    const totalTexels = this._texWidth * this._texHeight;
    const gl = this._gl;
    // Create R32UI texture
    const tex = gl.createTexture();
    if (!tex) {
      return false;
    }
    this.texture = tex;
    try {
      this.buffer = new Uint32Array(totalTexels);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32UI, this._texWidth, this._texHeight);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (e) {
      gl.deleteTexture(tex);
      return false;
    }
    // Entire range is initially free
    this._free.push({base: 0, size: this.capacity});
    return true;
  }

  /** Texture width (in texels). */
  get texWidth(): number {
    return this._texWidth;
  }

  /** Texture height (in texels). */
  get texHeight(): number {
    return this._texHeight;
  }

  // ---------------- Allocation API ----------------

  /**
   * Check if a contiguous portion of `size` entries can be allocated.
   * @param size
   */
  canGetPortion(size: number): boolean {
    if (size <= 0) {
      return false;
    }
    if (this._findFree(size) !== -1) {
      return true;
    }
    if (this._packed) {
      return false;
    }
    this._pack();
    return this._findFree(size) !== -1;
  }

  /**
   * Allocate a contiguous portion of `size` entries.
   * Optionally provide `onMove` to be notified if packing moves this portion.
   */
  getPortion(size: number, onMove?: (newBase: number) => void): DTXPointerArrayHandle {
    if (size <= 0) {
      throw new Error("DTXPointerArray.getPortion: size must be > 0");
    }
    let idx = this._findFree(size);
    if (idx === -1) {
      this._pack();
      idx = this._findFree(size);
      if (idx === -1) {
        throw new Error(`DTXPointerArray: allocation failed for size=${size}`);
      }
    }
    this._packed = false;
    this._numUsedElements += size;
    return this._allocAtFreeIndex(idx, size, onMove);
  }

  /** Free a previously allocated portion. */
  putPortion(handle: DTXPointerArrayHandle): void {
    const portion = this._used.get(handle.id);
    if (!portion) {
      return;
    }

    this._used.delete(handle.id);
    this._handles.delete(handle.id);
    this._onMove.delete(handle.id);

    this._insertFreeSorted(portion);
    this._coalesceFree();
    this._packed = false;
    this._numUsedElements -= portion.size;
  }

  /** Get a typed view into a portion (Uint32Array view). */
  getPortionView(handle: DTXPointerArrayHandle): Uint32Array<any> {
    const portion = this._used.get(handle.id);
    if (!portion) throw new Error("DTXPointerArray.getPortionView: invalid handle");
    return this.buffer.subarray(portion.base, portion.base + portion.size);
  }

  // ---------------- Data writes ----------------

  /** Set a single entry value (marks a 1-sized dirty portion). */
  setItem(index: number, value: number): void {
    this._assertIndex(index);
    this.buffer[index] = value >>> 0;
    // Track as a synthetic 1-sized portion using a temp id; coalesce on uploadChanges
    const id = this._markSyntheticDirty(index, 1);
    this._dirtyPortions.add(id);
  }

  /** Write exactly `portion.size` values into a portion. */
  setPortionData(handle: DTXPointerArrayHandle, values: ArrayLike<number>): void {
    const portion = this._used.get(handle.id);
    if (!portion) throw new Error("DTXPointerArray.setPortionData: invalid handle");
    if (values.length !== portion.size) {
      throw new Error(`DTXPointerArray.setPortionData: expected ${portion.size}, got ${values.length}`);
    }
    const base = portion.base;
    for (let i = 0; i < portion.size; i++) {
      this.buffer[base + i] = (values[i] >>> 0);
    }
    this._dirtyPortions.add(handle.id);
  }

  /** Fill a portion with the same 32-bit value. */
  fillPortion(handle: DTXPointerArrayHandle, value: number): void {
    const portion = this._used.get(handle.id);
    if (!portion) throw new Error("DTXPointerArray.fillPortion: invalid handle");
    this.buffer.fill((value >>> 0), portion.base, portion.base + portion.size);
    this._dirtyPortions.add(handle.id);
  }

  // ---------------- GPU upload ----------------

  /**
   * Uploads all dirty regions (coalesced per row) or entire buffer after a pack().
   * Note: This unbinds the texture when done. If your render path samples this
   * texture immediately after, re-bind it to the intended unit.
   */
  uploadChanges(): boolean {
    if (this._dirtyPortions.size === 0 && !this._uploadAllOnFlush) {
      return false;
    }
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    if (this._uploadAllOnFlush) {
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0,
        0, 0,
        this._texWidth, this._texHeight,
        gl.RED_INTEGER, gl.UNSIGNED_INT,
        this.buffer
      );
      this._dirtyPortions.clear();
      this._uploadAllOnFlush = false;
      gl.bindTexture(gl.TEXTURE_2D, null);
      return true;
    }

    // Gather segments to upload
    const itemsPerRow = this._texWidth;
    type Seg = { base: number; size: number; };
    const segs: Seg[] = [];

    for (const id of this._dirtyPortions) {
      const portion = this._used.get(id);
      if (portion) {
        segs.push({base: portion.base, size: portion.size});
      }
    }
    this._dirtyPortions.clear();

    // Sort by base; coalesce adjacent segs
    segs.sort((a, b) => a.base - b.base);
    const coalesced: Seg[] = [];
    for (const s of segs) {
      const last = coalesced[coalesced.length - 1];
      if (last && (last.base + last.size) === s.base) {
        last.size += s.size;
      } else {
        coalesced.push({base: s.base, size: s.size});
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

        const sub = this.buffer.subarray(base, base + count);
        gl.texSubImage2D(
          gl.TEXTURE_2D, 0,
          x, y,
          count, 1,
          gl.RED_INTEGER, gl.UNSIGNED_INT,
          sub
        );
        base += count;
        remaining -= count;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    return true;
  }

  /** Destroy GL resources. */
  destroy(): void {
    if (this.texture) {
      this.buffer = null;
      this._gl.deleteTexture(this.texture);
    }
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
    return {x: (a % w) | 0, y: (a / w) | 0};
  }

  // GLSL helpers (drop into your shader):
  //
  // ivec2 dtxAddrToUV(uint addr, uint texWidth) {
  //   return ivec2(int(addr % texWidth), int(addr / texWidth));
  // }
  // uint dtxLookup(usampler2D lookupTex, uint index) {
  //   // one uint per texel (R32UI)
  //   int texW = textureSize(lookupTex, 0).x;
  //   ivec2 uv = ivec2(int(index % uint(texW)), int(index / uint(texW)));
  //   return texelFetch(lookupTex, uv, 0).r;
  // }

  // ---------------- Internals ----------------

  private _assertIndex(i: number) {
    if (i < 0 || i >= this.capacity) {
      throw new RangeError(`DTXPointerArray: index ${i} out of range [0, ${this.capacity})`);
    }
  }

  private _findFree(size: number): number {
    return this._free.findIndex(b => b.size >= size);
  }

  private _allocAtFreeIndex(idx: number, size: number, onMove?: (newBase: number) => void): DTXPointerArrayHandle {
    const block = this._free[idx];
    const id = this._nextId++;
    const portion: Portion = {base: block.base, size};
    this._used.set(id, portion);

    if (size === block.size) {
      this._free.splice(idx, 1);
    } else {
      block.base += size;
      block.size -= size;
    }

    const handle: DTXPointerArrayHandle = {id, base: portion.base};
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
    if (this._packed) {
      return;
    }
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
      newUsed.set(id, {base: writeHead, size: portion.size});
      writeHead += portion.size;
    }

    this._used = newUsed;
    this._free = writeHead < this.capacity ? [{base: writeHead, size: this.capacity - writeHead}] : [];
    this._packed = true;
  }

  /**
   * Create a synthetic one-portion entry for setItem uploads.
   * We don't keep these between frames; they only exist for the next uploadChanges().
   */
  private _markSyntheticDirty(base: number, size: number): number {
    const id = this._nextId++;
    this._used.set(id, {base, size});
    // No handle/onMove created for synthetic portions
    return id;
  }


}
