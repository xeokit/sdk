import { type FloatArrayParam } from "../../../../math";
import {SDKInternalException} from "../../../../core";
import {DataTexture} from "./DataTexture";

/**
 * DTXQuantRanges
 * --------------
 * GPU texture of per-item dequantization ranges (offset+scale).
 *
 * Per item ("quantRange"):
 *   texel 0: RGBA32F -> offset.xyz in .rgb, .a unused
 *   texel 1: RGBA32F -> scale.xyz  in .rgb, .a unused
 *
 * - 1 item = 2 texels = 8 floats (we store 6 and leave 2 padding floats)
 * - Integer count is "maxItems"
 * - Uses batched row-aligned uploads for dirty items
 */
export class DTXQuantRanges extends DataTexture {

  private gl: WebGL2RenderingContext;
  private dirtyIndices: Set<number>;
  private maxItems: number;
  private numUsedItems: number;

  // Layout constants
  private static readonly TEXELS_PER_ITEM = 2;     // offset, scale
  private static readonly FLOATS_PER_TEXEL = 4;    // RGBA
  private static readonly FLOATS_PER_ITEM = DTXQuantRanges.TEXELS_PER_ITEM * DTXQuantRanges.FLOATS_PER_TEXEL; // 8

  constructor(params: {
    gl: WebGL2RenderingContext;
    /** Maximum number of quant ranges (items) to support (default 2000) */
    maxItems?: number;
    description?: string;
  }) {
    super();
    this.description = params.description || "geometryIndex -> dequantization range (offset + scale)";
    this.gl = params.gl;
    this.maxItems = params.maxItems ?? 20000;
    this.dirtyIndices = new Set()
    this.numUsedItems = 0;
  }

  static get itemSizeInBytes(): number {
    return DTXQuantRanges.FLOATS_PER_ITEM * 4; // 4 bytes per float
  }

  getAllocatedBytes(): number {
    return this.maxItems * DTXQuantRanges.itemSizeInBytes;
  }

  getUsedBytes() {
    return this.numUsedItems * DTXQuantRanges.itemSizeInBytes;
  }

  /**
   * Allocates the RGBA32F texture and backing array.
   * We keep the texture fairly wide to minimize row breaks.
   */
 allocate(): boolean {
    const gl = this.gl;
    const itemsPerRow = 1024; // 1024 items per row * 2 texels/item = 2048 texels wide
    const texelsPerItem = DTXQuantRanges.TEXELS_PER_ITEM;
    const width = itemsPerRow * texelsPerItem; // texels
    const height = Math.max(1, Math.ceil(this.maxItems / itemsPerRow)); // rows
    const totalTexels = width * height;
    const totalFloats = totalTexels * DTXQuantRanges.FLOATS_PER_TEXEL;
    const texture = gl.createTexture();
    if (!texture) {
    return false;
    }
    try {
        this.buffer = new Float32Array(totalFloats);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
      // initialize with zeros (optional)
      //  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, this.buffer, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (e) {
        gl.deleteTexture(texture);
        return false;
    }
    this.texture = texture;
    this.width = width;
    this.height = height;
    return true;
  }

  /**
   * Set a quantRange at geometryIndex using two vec3s.
   */
  setQuantRange(geometryIndex: number, dequantizeOffset: FloatArrayParam, dequantizeScale: FloatArrayParam): void {
    if (geometryIndex < 0 || geometryIndex >= this.maxItems) {
      throw new SDKInternalException(`DTXQuantRanges: geometryIndex ${geometryIndex} out of range [0, ${this.maxItems})`);
    }
    const base = geometryIndex * DTXQuantRanges.FLOATS_PER_ITEM;

    // texel 0: offset.xyz in .rgb
    this.buffer[base + 0] = +dequantizeOffset[0];
    this.buffer[base + 1] = +dequantizeOffset[1];
    this.buffer[base + 2] = +dequantizeOffset[2];
    // base+3 (.a) left unused/padding
    this.buffer[base + 3] = 0.0;

    // texel 1: scale.xyz in .rgb
    this.buffer[base + 4] = +dequantizeScale[0];
    this.buffer[base + 5] = +dequantizeScale[1];
    this.buffer[base + 6] = +dequantizeScale[2];
    // base+7 (.a) left unused/padding
    this.buffer[base + 7] = 0.0;

    this.dirtyIndices.add(geometryIndex);
  }

  /**
   * Convenience: set from a flat 6-float array [ox,oy,oz, sx,sy,sz].
   */
  setQuantRangeArray(geometryIndex: number, six: FloatArrayParam): void {
    this.setQuantRange(geometryIndex, [six[0], six[1], six[2]], [six[3], six[4], six[5]]);
  }

  /**
   * Upload all dirty items with batched, row-aligned subimage calls.
   */
  uploadChanges(): boolean {
    if (this.dirtyIndices.size === 0) {
      return false;
    }
    this.bufferUpdated();
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const texelsPerItem = DTXQuantRanges.TEXELS_PER_ITEM;        // 2
    const floatsPerItem = DTXQuantRanges.FLOATS_PER_ITEM;        // 8
    const itemsPerRow = this.width / texelsPerItem;       // integer

    const sorted = Array.from(this.dirtyIndices).sort((a, b) => a - b);

    let runStart = -1, prev = -2;
    const pushRun = (start: number, end: number) => {
      let idx = start;
      while (idx <= end) {
        const row = Math.floor(idx / itemsPerRow);
        const xItem = idx % itemsPerRow;
        const rowLeftItems = itemsPerRow - xItem;
        const maxChunkItems = end - idx + 1;
        const chunkItems = Math.min(rowLeftItems, maxChunkItems);

        const xTexel = xItem * texelsPerItem;
        const widthTexels = chunkItems * texelsPerItem;

        const floatStart = idx * floatsPerItem;
        const floatEnd = floatStart + chunkItems * floatsPerItem;
        const sub = this.buffer.subarray(floatStart, floatEnd);

        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          xTexel,
          row,
          widthTexels,
          1,
          gl.RGBA,
          gl.FLOAT,
          sub
        );

        idx += chunkItems;
      }

      return true;
    };

    for (const i of sorted) {
      if (i !== prev + 1 || Math.floor(i / itemsPerRow) !== Math.floor(prev / itemsPerRow)) {
        if (runStart >= 0) pushRun(runStart, prev);
        runStart = i;
      }
      prev = i;
    }
    if (runStart >= 0) pushRun(runStart, prev);

    gl.bindTexture(gl.TEXTURE_2D, null);
    this.dirtyIndices.clear();
  }

  readAtTexel(x: number, y: number): {
    offset: [number, number, number],
    scale: [number, number, number]
  } {
    const texelsPerRow = this.width;
    const index = y * texelsPerRow + x;
    const itemIndex = Math.floor(index / DTXQuantRanges.TEXELS_PER_ITEM);
    const base = itemIndex * DTXQuantRanges.FLOATS_PER_ITEM;

    const offset: [number, number, number] = [
      this.buffer[base + 0],
      this.buffer[base + 1],
      this.buffer[base + 2]
    ];
    const scale: [number, number, number] = [
      this.buffer[base + 4],
      this.buffer[base + 5],
      this.buffer[base + 6]
    ];

    return { offset, scale };
  }

  getItem(geometryIndex: number): {
    offset: [number, number, number],
    scale: [number, number, number]}
  {
    if (geometryIndex < 0 || geometryIndex >= this.maxItems) {
      throw new SDKInternalException(`DTXQuantRanges: geometryIndex ${geometryIndex} out of range [0, ${this.maxItems})`);
    }
    const base = geometryIndex * DTXQuantRanges.FLOATS_PER_ITEM;

    const offset: [number, number, number] = [
      this.buffer[base + 0],
      this.buffer[base + 1],
      this.buffer[base + 2]
    ];
    const scale: [number, number, number] = [
      this.buffer[base + 4],
      this.buffer[base + 5],
      this.buffer[base + 6]
    ];

    return { offset, scale };
  }

    destroy(): void {
    if (this.texture) {
      this.buffer = null;
      this.gl.deleteTexture(this.texture);
    }
  }


}
