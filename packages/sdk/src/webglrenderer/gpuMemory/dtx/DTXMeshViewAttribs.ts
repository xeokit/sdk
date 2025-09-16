// Fixed spec metadata
export type DTXMeshViewAttribsItem = {
  color: [number, number, number, number];   // uvec4 bytes 0..255
  flags1: number;  // uvec4 bytes 0..255
  flags2: number;  // uvec4 bytes 0..255
};

export interface DTXMeshViewAttribsOptions {
  gl: WebGL2RenderingContext;
  capacity: number;
  /** Ignored if provided; layout is fixed to {color, flags1, flags2} uvec4. */
  structSpec?: unknown;
}

/**
 * GPU-backed array of fixed structs { color, flags1, flags2 } (all uvec4), stored in RGBA8UI.
 * - 1 field == 1 texel (RGBA8UI)
 * - 1 struct == 3 texels
 * - Upload path uses RGBA_INTEGER / UNSIGNED_BYTE
 */
export class DTXMeshViewAttribs {
  readonly texture: WebGLTexture;
  readonly capacity: number;

  /** Backing store in bytes (each lane is 0..255). */
  public buffer: Uint8Array<any>;

  private _gl: WebGL2RenderingContext;

  // Layout (in texels, not floats)
  private static readonly TEXELS_PER_STRUCT = 3; // color, flags1, flags2
  private static readonly LANES_PER_TEXEL = 4; // RGBA
  private static readonly BYTES_PER_TEXEL = 4; // RGBA8UI

  // Texture geometry
  private _texWidth: number;       // in texels
  private _texelsPerRow: number;   // == _texWidth
  private _texHeight: number;      // in texels (rows)

  private _dirty = new Set<number>(); // struct indices

  constructor( options: DTXMeshViewAttribsOptions ) {
    this._gl = options.gl;
    this.capacity = options.capacity;

    // Choose a wide power-of-two for fewer rows
    this._texWidth = 4096; // texels
    this._texelsPerRow = this._texWidth;

    const structs = this.capacity;
    const texelsNeeded = structs * DTXMeshViewAttribs.TEXELS_PER_STRUCT;
    this._texHeight = Math.max(1, Math.ceil(texelsNeeded / this._texelsPerRow));

    const totalTexels = this._texWidth * this._texHeight;
    const totalBytes = totalTexels * DTXMeshViewAttribs.BYTES_PER_TEXEL;

    this.buffer = new Uint8Array(totalBytes);

    const gl = this._gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // Allocate RGBA8UI storage
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8UI,
      this._texWidth,
      this._texHeight,
      0,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_BYTE,
      this.buffer
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
    this.texture = tex;
  }


  private getStructByteView( meshIndex: number ): Uint8Array<any> {
    const startTexel = meshIndex * DTXMeshViewAttribs.TEXELS_PER_STRUCT;
    const byteOffset = startTexel * DTXMeshViewAttribs.BYTES_PER_TEXEL;
    return this.buffer.subarray(byteOffset, byteOffset + 3 * DTXMeshViewAttribs.BYTES_PER_TEXEL);
  }

  setAttribs(meshIndex: number, data: Partial<DTXMeshViewAttribsItem>): void {
    // optional: bounds guard
    if (meshIndex < 0 || meshIndex >= this.capacity) {
      throw new RangeError(`meshIndex ${meshIndex} out of range [0, ${this.capacity})`);
    }

    const v = this.getStructByteView(meshIndex);

    const writeRGBA = (base: number, src?: [number, number, number, number]) => {
      if (!src) return;
      v[base + 0] = (Math.floor(src[0]*255) | 0) & 0xFF;
      v[base + 1] = (Math.floor(src[1]*255) | 0) & 0xFF;
      v[base + 2] = (Math.floor(src[2]*255) | 0) & 0xFF;
      v[base + 3] = (Math.floor(src[3]*255) | 0) & 0xFF;
    };

    // Pack a uint32 into RGBA8 lanes (little-endian: R=LSB, A=MSB).
    const writeU32 = (base: number, n?: number) => {
      if (n === undefined) return;
      const u = (n >>> 0); // coerce to uint32
      v[base + 0] =  u         & 0xFF;
      v[base + 1] = (u >>> 8)  & 0xFF;
      v[base + 2] = (u >>> 16) & 0xFF;
      v[base + 3] = (u >>> 24) & 0xFF;
    };

    // texel 0: color (RGBA8UI)
    writeRGBA(0, data.color);
    // texel 1: flags1 as uint32 -> RGBA8UI lanes
    writeU32(4, data.flags1);
    // texel 2: flags2 as uint32 -> RGBA8UI lanes
    writeU32(8, data.flags2);

    this._dirty.add(meshIndex);
  }

  flush(): void {
    if (this._dirty.size === 0) return;
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    for (const idx of this._dirty) {
      let startTexel = idx * DTXMeshViewAttribs.TEXELS_PER_STRUCT;
      let remainingTexels = DTXMeshViewAttribs.TEXELS_PER_STRUCT;

      while (remainingTexels > 0) {
        const row = Math.floor(startTexel / this._texelsPerRow);
        const x = startTexel % this._texelsPerRow;
        const rowLeft = this._texelsPerRow - x;
        const chunkTexels = Math.min(remainingTexels, rowLeft);

        const byteStart = (row * this._texelsPerRow + x) * DTXMeshViewAttribs.BYTES_PER_TEXEL;
        const byteEnd = byteStart + chunkTexels * DTXMeshViewAttribs.BYTES_PER_TEXEL;
        const sub = this.buffer.subarray(byteStart, byteEnd);

        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          x, row,
          chunkTexels, 1,
          gl.RGBA_INTEGER,
          gl.UNSIGNED_BYTE,
          sub
        );

        startTexel += chunkTexels;
        remainingTexels -= chunkTexels;
      }
    }

    this._dirty.clear();
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** WebGL texture handle. */
  getTexture(): WebGLTexture {
    return this.texture;
  }

  destroy(): void {
    this._gl.deleteTexture(this.texture);
  }
}
