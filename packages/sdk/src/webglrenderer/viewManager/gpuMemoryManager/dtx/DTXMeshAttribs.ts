// A single data element (uvec4: four uint32 lanes)
import {DataTexture} from "./DataTexture";

export type DTXUvec4 = [number, number, number, number];

/**
 * Minimal GPU-backed array of uvec4 elements in an RGBA32UI texture.
 * - Each element is exactly one texel (RGBA32UI) = 4x uint32 lanes.
 * - Integer upload path (RGBA_INTEGER / UNSIGNED_INT).
 * - Tracks dirty indices and uploads only changed texels.
 */
export class DTXMeshAttribs extends DataTexture {

  readonly maxItems: number;

  private _gl: WebGL2RenderingContext;
  private _dirty = new Set<number>(); // element indices (texels)

  constructor(options: {
    gl: WebGL2RenderingContext;
    /** Number of uvec4 elements to store (each element = 1 texel). */
    maxItems: number;
    description?: string;
  }) {
    super();
    this.description = options.description || "meshIndex -> (tileIndex, geometryIndex)";
    this._gl = options.gl;
    this.maxItems = options.maxItems;
  }

  /**
   * Total capacity in bytes.
   */
  getAllocatedBytes(): number {
    return this.maxItems * DTXMeshAttribs.itemSizeInBytes;
  }

  /**
   * Size in bytes of a single matrix element (mat4).
   */
  static get itemSizeInBytes() {
    return 16; // 4 uint32 lanes per uvec4, 4 bytes each
  }

  getUsedBytes() {
    return 0;
  }

  allocate(): boolean {
    // Clamp to device limits and keep rows wide to reduce uploads.
    const gl = this._gl;
    const maxSize = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) | 0;

    this.width = 4096;

    const texelsNeeded = this.maxItems;
    this.height = Math.max(1, Math.ceil(texelsNeeded / this.width));
    // if (this.height > maxSize) {
    //   // Try widening to reduce height
    //   this.width = Math.min(maxSize, Math.ceil(texelsNeeded / maxSize));
    //   this.height = Math.max(1, Math.ceil(texelsNeeded / this.width));
    //   if (this.height > maxSize) {
    //     throw new Error(
    //       `DTXMeshAttribs: maxItems ${this.maxItems} exceeds max 2D texture area ${maxSize}x${maxSize}`
    //     );
    //   }
    // }

    const totalTexels = this.width * this.height;
    const totalElems = totalTexels * 4; // 1x uvec4 per mesh

    // Allocate integer texture (RGBA32UI)
    const tex = gl.createTexture()!;
    if (!tex) {
      return false;
    }
    try {
      this.buffer = new Uint32Array(totalElems);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // safe for tightly packed rows
      /** Backing lanes (RGBA32UI). One element = 4 uint32s (16 bytes). */
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32UI, this.width, this.height);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (e) {
      gl.deleteTexture(tex);
      return false;
    }
    this.texture = tex;
    return true;
  }

  /** Texture size (texels). */
  get texWidth(): number {
    return this.width;
  }

  get texHeight(): number {
    return this.height;
  }


  /** Write one element directly (uvec4 lanes). */
  setItem(index: number, lanes: DTXUvec4): void {
    this._assertIndex(index);
    const b = index * 4;
    this.buffer[b + 0] = lanes[0] >>> 0;
    this.buffer[b + 1] = lanes[1] >>> 0;
    this._dirty.add(index);
  }

  /** Named lanes convenience for four 32-bit unsigned indices. */
  setAttribs(meshIndex: number, v: {
    tileIndex?: number;
    geometryIndex?: number;
  }): void {
    this._assertIndex(meshIndex);
    const c = meshIndex * 4; // 1x uvec4 per mesh
    const toU32 = (x: number): number => typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);
    if (v.tileIndex !== undefined) this.buffer[c + 0] = toU32(v.tileIndex);
    if (v.geometryIndex !== undefined) this.buffer[c + 1] = toU32(v.geometryIndex);
    this._dirty.add(meshIndex);
  }

  /**
   * Sample the texture at given texel coordinates.
   * @param x
   * @param y
   */
  readAtTexel(x: number, y: number): {
    tileIndex: number;
    geometryIndex: number
  } {
    const clampedX = Math.min(this.width - 1, Math.max(0, x));
    const clampedY = Math.min(this.height - 1, Math.max(0, y));
    const idx = clampedY * this.width + clampedX;
    const b = idx * 4;
    return {
      tileIndex: this.buffer[b + 0],
      geometryIndex: this.buffer[b + 1],
    };
  }

  getItem(meshIndex: number): {
    tileIndex: number;
    geometryIndex: number
  } {
    const c = meshIndex * 4; // 1x uvec4 per mesh
    return {
      tileIndex: this.buffer[c + 0],
      geometryIndex: this.buffer[c + 1],
    };
  }

  /** Upload dirty elements. Groups contiguous indices and splits at row ends. */
  uploadChanges(): boolean {
    if (this._dirty.size === 0) {
      return false;
    }
    this.bufferUpdated();
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // Sort and coalesce runs
    const sorted = Array.from(this._dirty).sort((a, b) => a - b);
    let runStart = -1, prev = -2;

    const pushRun = (start: number, end: number) => { // inclusive
      let idx = start;
      while (idx <= end) {
        const row = Math.floor(idx / this.width);
        const x = idx % this.width;
        const rowLeft = this.width - x;
        const maxChunk = end - idx + 1;
        const chunk = Math.min(rowLeft, maxChunk);

        const elemStart = (row * this.width + x) * 4;
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


    return true;
  }

  private _assertIndex(i: number) {
    if (i < 0 || i >= this.maxItems) {
      throw new Error(`DTXMeshAttribs: index ${i} out of range 0..${this.maxItems - 1}`);
    }
  }

  destroy(): void {
    if (this.texture) {
      this.buffer = null;
      this._gl.deleteTexture(this.texture);
    }
  }


}

