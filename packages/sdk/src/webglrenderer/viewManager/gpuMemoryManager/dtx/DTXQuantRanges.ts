import { type FloatArrayParam } from "../../../../math";

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
 * - Integer count is "capacity"
 * - Uses batched row-aligned uploads for dirty items
 */
export class DTXQuantRanges {

  /** RGBA32F texture handle. */
  public texture: WebGLTexture;

  /** Backing buffer (Float32). One item = 8 floats. */
  public buffer: Float32Array<any>;

  private gl: WebGL2RenderingContext;
  private dirtyIndices: Set<number>;
  private textureWidth: number; // in texels
  private textureHeight: number; // in texels
  private maxItems: number;

  // Layout constants
  private static readonly TEXELS_PER_ITEM = 2;     // offset, scale
  private static readonly FLOATS_PER_TEXEL = 4;    // RGBA
  private static readonly FLOATS_PER_ITEM = DTXQuantRanges.TEXELS_PER_ITEM * DTXQuantRanges.FLOATS_PER_TEXEL; // 8

  constructor(params: {
    gl: WebGL2RenderingContext;
    /** Maximum number of quant ranges (items) to support (default 2000) */
    capacity?: number;
  }) {
    this.gl = params.gl;
    this.maxItems = params.capacity ?? 20000;
    this.dirtyIndices = new Set();
    this.#allocateTexture();
  }

  /**
   * Allocates the RGBA32F texture and backing array.
   * We keep the texture fairly wide to minimize row breaks.
   */
  #allocateTexture(): void {
    const gl = this.gl;
    const itemsPerRow = 1024; // 1024 items per row * 2 texels/item = 2048 texels wide
    const texelsPerItem = DTXQuantRanges.TEXELS_PER_ITEM;
    const textureWidth = itemsPerRow * texelsPerItem; // texels
    const textureHeight = Math.max(1, Math.ceil(this.maxItems / itemsPerRow)); // rows
    const totalTexels = textureWidth * textureHeight;
    const totalFloats = totalTexels * DTXQuantRanges.FLOATS_PER_TEXEL;
    this.buffer = new Float32Array(totalFloats);
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("DTXQuantRanges: Failed to create texture");
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
    // initialize with zeros (optional)
  //  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, this.buffer, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.texture = texture;
    this.textureWidth = textureWidth;
    this.textureHeight = textureHeight;
  }

  /**
   * Set a quantRange at geometryIndex using two vec3s.
   */
  setQuantRange(geometryIndex: number, dequantizeOffset: FloatArrayParam, dequantizeScale: FloatArrayParam): void {
    if (geometryIndex < 0 || geometryIndex >= this.maxItems) {
      throw new RangeError(`DTXQuantRanges: geometryIndex ${geometryIndex} out of range [0, ${this.maxItems})`);
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
  flush(): boolean {
    if (this.dirtyIndices.size === 0) {
      return false;
    }

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const texelsPerItem = DTXQuantRanges.TEXELS_PER_ITEM;        // 2
    const floatsPerItem = DTXQuantRanges.FLOATS_PER_ITEM;        // 8
    const itemsPerRow = this.textureWidth / texelsPerItem;       // integer

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

  destroy(): void {
    this.gl.deleteTexture(this.texture);
  }

}
