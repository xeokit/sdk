export interface DTXGeometryAttribsOptions {
  gl: WebGL2RenderingContext;
  /** Number of uint elements to store (each element = 1 texel). */
  capacity: number;
  /** Optional override for texture width (texels). Defaults to 4096 and is clamped to MAX_TEXTURE_SIZE. */
  texWidth?: number;
}

/**
 * Minimal GPU-backed array of uint32 elements in an R32UI texture.
 * - Each element is exactly one texel (R32UI).
 * - Integer upload path (RED_INTEGER / UNSIGNED_INT).
 * - Tracks dirty indices and uploads only changed texels.
 */
export class DTXGeometryAttribs {
  readonly texture: WebGLTexture;
  readonly capacity: number;

  /** Backing lanes (one uint per texel). */
  public buffer: Uint32Array<any>;

  private _gl: WebGL2RenderingContext;
  private _texWidth: number;     // texels per row
  private _texHeight: number;    // rows
  private _dirty = new Set<number>(); // element indices (texels)

  constructor(options: DTXGeometryAttribsOptions) {
    this._gl = options.gl;
    this.capacity = options.capacity;

    const gl = this._gl;
    const maxSize = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) | 0;

    this._texWidth = Math.max(1, Math.min(options.texWidth ?? 4096, maxSize));

    const texelsNeeded = this.capacity;
    this._texHeight = Math.max(1, Math.ceil(texelsNeeded / this._texWidth));
    if (this._texHeight > maxSize) {
      // Widen to reduce height, then re-check.
      this._texWidth = Math.min(maxSize, Math.ceil(texelsNeeded / maxSize));
      this._texHeight = Math.max(1, Math.ceil(texelsNeeded / this._texWidth));
      if (this._texHeight > maxSize) {
        throw new Error(
          `DTXGeometryAttribs: capacity ${this.capacity} exceeds max 2D texture area ${maxSize}x${maxSize}`
        );
      }
    }

    const totalTexels = this._texWidth * this._texHeight;
    this.buffer = new Uint32Array(totalTexels);

    // Allocate integer texture (R32UI)
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32UI,
      this._texWidth,
      this._texHeight,
      0,
      gl.RED_INTEGER,
      gl.UNSIGNED_INT,
      this.buffer
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
    this.texture = tex;
  }

  /** Texture size (texels). */
  get texWidth(): number { return this._texWidth; }
  get texHeight(): number { return this._texHeight; }

  /** Read one element (uint32). */
  getItem(index: number): number {
    this._assertIndex(index);
    return this.buffer[index] >>> 0;
  }

  /** Write one element (uint32). */
  setItem(index: number, value: number ): void {
    this._assertIndex(index);
    const u32 = typeof value === "bigint" ? Number(value & 0xFFFFFFFFn) : (value >>> 0);
    this.buffer[index] = u32;
    this._dirty.add(index);
  }

  /** Bulk write starting at `startIndex`. Accepts any iterable of numbers/bigints. */
  setItems(startIndex: number, values: Iterable<number>): void {
    let i = 0;
    for (const v of values) {
      const idx = startIndex + i++;
      this._assertIndex(idx);
      this.buffer[idx] = typeof v === "bigint" ? Number(v & 0xFFFFFFFFn) : (v >>> 0);
      this._dirty.add(idx);
    }
  }

  /** Upload dirty elements; groups contiguous indices and splits at row ends. */
  flush(): void {
    if (this._dirty.size === 0) return;
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const sorted = Array.from(this._dirty).sort((a, b) => a - b);
    let runStart = -1, prev = -2;

    const pushRun = (start: number, end: number) => {
      let idx = start;
      while (idx <= end) {
        const row = Math.floor(idx / this._texWidth);
        const x = idx % this._texWidth;
        const rowLeft = this._texWidth - x;
        const maxChunk = end - idx + 1;
        const chunk = Math.min(rowLeft, maxChunk);

        const elemStart = row * this._texWidth + x;
        const elemEnd   = elemStart + chunk;
        const sub = this.buffer.subarray(elemStart, elemEnd);

        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          x, row,
          chunk, 1,
          gl.RED_INTEGER,
          gl.UNSIGNED_INT,
          sub
        );

        idx += chunk;
      }
    };

    for (const i of sorted) {
      if (i !== prev + 1) {
        if (runStart >= 0) pushRun(runStart, prev);
        runStart = i;
      }
      prev = i;
    }
    if (runStart >= 0) pushRun(runStart, prev);

    this._dirty.clear();
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** WebGL texture handle. */
  getTexture(): WebGLTexture { return this.texture; }

  destroy(): void {
    this._gl.deleteTexture(this.texture);
  }

  private _assertIndex(i: number) {
    if (i < 0 || i >= this.capacity) {
      throw new RangeError(`DTXGeometryAttribs: index ${i} out of range [0, ${this.capacity})`);
    }
  }
}
