// A single data element (uvec4: four uint32 lanes)
export type DTXUvec4 = [number, number, number, number];

export interface DTXUvec4ArrayOptions {
  gl: WebGL2RenderingContext;
  /** Number of uvec4 elements to store (each element = 1 texel). */
  capacity: number;
  /** Optional override; defaults to 4096 texels (clamped to MAX_TEXTURE_SIZE). */
  texWidth?: number;
}

/**
 * Minimal GPU-backed array of uvec4 elements in an RGBA32UI texture.
 * - Each element is exactly one texel (RGBA32UI) = 4x uint32 lanes.
 * - Integer upload path (RGBA_INTEGER / UNSIGNED_INT).
 * - Tracks dirty indices and uploads only changed texels.
 */
export class DTXMeshAttribs {
  readonly texture: WebGLTexture;
  readonly capacity: number;

  /** Backing lanes (RGBA32UI). One element = 4 uint32s (16 bytes). */
  public buffer: Uint32Array<any>;

  private _gl: WebGL2RenderingContext;
  private _texWidth: number;      // texels per row
  private _texHeight: number;     // rows
  private _dirty = new Set<number>(); // element indices (texels)

  constructor( options: DTXUvec4ArrayOptions ) {
    this._gl = options.gl;
    this.capacity = options.capacity;

    // Clamp to device limits and keep rows wide to reduce uploads.
    const gl = this._gl;
    const maxSize = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) | 0;

    this._texWidth = Math.max(1, Math.min(options.texWidth ?? 4096, maxSize));

    const texelsNeeded = this.capacity;
    this._texHeight = Math.max(1, Math.ceil(texelsNeeded / this._texWidth));
    if (this._texHeight > maxSize) {
      // Try widening to reduce height
      this._texWidth = Math.min(maxSize, Math.ceil(texelsNeeded / maxSize));
      this._texHeight = Math.max(1, Math.ceil(texelsNeeded / this._texWidth));
      if (this._texHeight > maxSize) {
        throw new Error(
          `DTXMeshAttribs: capacity ${this.capacity} exceeds max 2D texture area ${maxSize}x${maxSize}`
        );
      }
    }

    const totalTexels = this._texWidth * this._texHeight;
    const totalElems = totalTexels * 4; // 4 uint32 lanes per texel
    this.buffer = new Uint32Array(totalElems);

    // Allocate integer texture (RGBA32UI)
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // safe for tightly packed rows

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32UI,              // 4x uint32 lanes per texel
      this._texWidth,
      this._texHeight,
      0,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_INT,
      this.buffer
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
    this.texture = tex;
  }

  /** Texture size (texels). */
  get texWidth(): number {
    return this._texWidth;
  }

  get texHeight(): number {
    return this._texHeight;
  }

  /** Read one element (uvec4 as four uint32s). */
  getItem( index: number ): DTXUvec4 {
    const b = index * 4;
    return [this.buffer[b], this.buffer[b + 1], this.buffer[b + 2], this.buffer[b + 3]];
  }

  /** Write one element directly (uvec4 lanes). */
  setItem( index: number, lanes: DTXUvec4 ): void {
    this._assertIndex(index);
    const b = index * 4;
    this.buffer[b + 0] = lanes[0] >>> 0;
    this.buffer[b + 1] = lanes[1] >>> 0;
    this.buffer[b + 2] = lanes[2] >>> 0;
    this.buffer[b + 3] = lanes[3] >>> 0;
    this._dirty.add(index);
  }

  /** Named lanes convenience for four 32-bit unsigned indices. */
  setAttribs( meshIndex: number, v: {
    tileIndex?: number;
    geometryIndex?: number;
    indicesBase?: number;
    edgeIndicesBase?: number;
  } ): void {
    this._assertIndex(meshIndex);
    const c = meshIndex * 4;
    const toU32 = ( x: number ): number =>
      typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);

    if (v.tileIndex !== undefined) this.buffer[c + 0] = toU32(v.tileIndex);
    if (v.geometryIndex !== undefined) this.buffer[c + 1] = toU32(v.geometryIndex);
    if (v.indicesBase !== undefined) this.buffer[c + 2] = toU32(v.indicesBase);
    if (v.edgeIndicesBase !== undefined) this.buffer[c + 3] = toU32(v.edgeIndicesBase);

    this._dirty.add(meshIndex);
  }

  /** Upload dirty elements. Groups contiguous indices and splits at row ends. */
  flush(): void {
    if (this._dirty.size === 0) return;
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // Sort and coalesce runs
    const sorted = Array.from(this._dirty).sort(( a, b ) => a - b);
    let runStart = -1, prev = -2;

    const pushRun = ( start: number, end: number ) => { // inclusive
      let idx = start;
      while (idx <= end) {
        const row = Math.floor(idx / this._texWidth);
        const x = idx % this._texWidth;
        const rowLeft = this._texWidth - x;
        const maxChunk = end - idx + 1;
        const chunk = Math.min(rowLeft, maxChunk);

        const elemStart = (row * this._texWidth + x) * 4;
        const elemEnd = elemStart + chunk * 4;
        const sub = this.buffer.subarray(elemStart, elemEnd);

        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          x, row,
          chunk, 1,
          gl.RGBA_INTEGER,
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

  private _assertIndex( i: number ) {
    if (i < 0 || i >= this.capacity) {
      throw new RangeError(`DTXUvec4Array: index ${i} out of range [0, ${this.capacity})`);
    }
  }

  /** WebGL texture handle. */
  getTexture(): WebGLTexture {
    return this.texture;
  }

  destroy(): void {
    this._gl.deleteTexture(this.texture);
  }
}

