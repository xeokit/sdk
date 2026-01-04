// A single data element (uvec4: four uint32 lanes)
import {DataTexture} from "./DataTexture";

import {SDKErrorType, SDKInternalException, SDKResult} from "../../../../core";

export type DTXUvec4 = [number, number, number, number];

export interface DTXUvec4ArrayOptions {
  gl: WebGL2RenderingContext;
  /** Number of uvec4 elements to store (each element = 1 texel). */
  maxItems: number;
  /** Optional override; defaults to 4096 texels (clamped to MAX_TEXTURE_SIZE). */
  texWidth?: number;
}

/**
 * Minimal GPU-backed array of uvec4 elements in an RGBA32UI texture.
 * - Each element is exactly one texel (RGBA32UI) = 4x uint32 lanes.
 * - Integer upload path (RGBA_INTEGER / UNSIGNED_INT).
 * - Tracks dirty indices and uploads only changed texels.
 */
export class DTXGeometryAttribTable extends DataTexture {

  private _gl: WebGL2RenderingContext;
  private _dirty = new Set<number>(); // element indices (texels)
  private _getNumItems: () => number;

  constructor(options: {
    gl: WebGL2RenderingContext;
    /** Number of uvec4 elements to store (each element = 1 texel). */
    maxItems: number;
    /** Optional override; defaults to 4096 texels (clamped to MAX_TEXTURE_SIZE). */
    texWidth?: number;
    description?: string;
    getNumItems: () => number;
  }) {
    super();
    this.description = options.description || "geometryIndex -> (verticesBase, indicesBase, edgeIndicesBase)";
    this._gl = options.gl;
    this.maxItems = options.maxItems;
    this._getNumItems = options.getNumItems;
  }

  get numItems(): number {
    return this._getNumItems();
  }

  /**
   * Size in bytes of a single matrix element (mat4).
   */
  static get itemSizeInBytes() {
    return 16; // 4 uint32 lanes per uvec4, 4 bytes each
  }

  getAllocatedBytes(): number {
    return this.maxItems * DTXGeometryAttribTable.itemSizeInBytes;
  }

  getUsedBytes(): number {
    return this._getNumItems() * DTXGeometryAttribTable.itemSizeInBytes;
  }

  allocate(): SDKResult<void> {
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
    //       `DTXGeometryAttribs: maxItems ${this.maxItems} exceeds max 2D texture area ${maxSize}x${maxSize}`
    //     );
    //   }
    // }
    const totalTexels = this.width * this.height;
    const totalElems = totalTexels * 4; // 4 uint32 lanes per texel
    this.buffer = new Uint32Array(totalElems);

    return this._allocateTexture();
  }

  webglContextRestored(): SDKResult<void> {
    return this._allocateTexture();
  }

  _allocateTexture(): SDKResult<void> {
    const gl = this._gl;
    const tex = gl.createTexture()!;
    if (!tex) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[DTXGeometryAttribTable]: Failed to create texture"
      };
    }
    try {
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
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[DTXGeometryAttribTable]: Exception during texture allocation: ${e}`
      };
    }
    this.texture = tex;
    return {
      ok: true,
      value: undefined
    };
  }

  /** Texture size (texels). */
  get texWidth(): number {
    return this.width;
  }

  get texHeight(): number {
    return this.height;
  }

  /** Write one element directly (uvec4 lanes). */
  setItem(geometryIndex: number, lanes: DTXUvec4): void {
    this._assertIndex(geometryIndex);
    const b = geometryIndex * 4;
    this.buffer[b + 0] = lanes[0] >>> 0;
    this.buffer[b + 1] = lanes[1] >>> 0;
    this.buffer[b + 2] = lanes[2] >>> 0;
    this.buffer[b + 3] = lanes[3] >>> 0;
    this._dirty.add(geometryIndex);
  }

  /** Named lanes convenience for four 32-bit unsigned indices. */
  setAttribs(geometryIndex: number, v: {
    verticesBase?: number;
    indicesBase?: number;
    edgeIndicesBase?: number;
  }): void {
    this._assertIndex(geometryIndex);
    const c = geometryIndex * 4; // 1x uvec4 per geometry
    const toU32 = (x: number): number => typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);
    if (v.verticesBase !== undefined) this.buffer[c + 0] = toU32(v.verticesBase);
    if (v.indicesBase !== undefined) this.buffer[c + 1] = toU32(v.indicesBase);
    if (v.edgeIndicesBase !== undefined) this.buffer[c + 2] = toU32(v.edgeIndicesBase);
    this._dirty.add(geometryIndex);
  }

  /** Upload dirty elements. Groups contiguous indices and splits at row ends. */
  uploadChanges(): boolean {
    if (this._dirty.size === 0) {
      return false;
    }
    const t0 = (this.debugging) ? performance.now() : 0;
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

        const elemStart = (row * this.width + x) * 8;
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

      if (this.debugging) {
        this.lastUploadTimeMS = performance.now() - t0;
      }

      this.notifyUpdated();

      return true;
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
      throw new SDKInternalException(`[DTXGeometryAttribTable]: geometryIndex ${i} out of range [0, ${this.maxItems})`);
    }
  }

  /** WebGL texture handle. */
  getTexture(): WebGLTexture {
    return this.texture;
  }

  getItem(geometryIndex: number): { verticesBase: number, indicesBase: number, edgeIndicesBase: number } {
    const b = geometryIndex * 4;
    return {
      verticesBase: this.buffer[b + 0],
      indicesBase: this.buffer[b + 1],
      edgeIndicesBase: this.buffer[b + 2],
    };
  }

  readAtTexel(x: number, y: number): {
    verticesBase: number,
    indicesBase: number,
    edgeIndicesBase: number
  } {
    const idx = (y * this.width + x) * 4;
    return {
      verticesBase: this.buffer[idx + 0],
      indicesBase: this.buffer[idx + 1],
      edgeIndicesBase: this.buffer[idx + 2],
    };
  }


    destroy(): void {
      if(this.texture) {
      this.buffer = null;
      this._gl?.deleteTexture(this.texture);
    }
  }
  }

