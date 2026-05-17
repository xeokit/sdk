import {ItemDataTexture} from "./ItemDataTexture";

/**
 * Stores per-slot dash / gap patterns for the thick-line draw
 * technique.
 *
 * The renderer routes each line-mesh's per-material
 * {@link SceneMaterial.linePattern} into one slot in this table
 * (per batch, allocated on demand by
 * {@link GPUMemoryBatch}). A 16-bit slot index lands in
 * {@link MeshAttributeTexture}'s alpha slot; the thick-line
 * vertex shader reads that index and, when non-zero, fetches
 * the slot's two texels here to recover the pattern.
 *
 * Slot 0 is reserved as the "no per-mesh pattern" sentinel —
 * meshes whose materials carry no pattern leave the slot index
 * at 0, and the shader falls back to the View-level
 * `linesMaterial.linePattern` uniform.
 *
 * Two texels per slot, eight u32 elements (linearised — `base`
 * is `slotIndex * elementsPerItem`):
 *   - `base + 0..3`  pattern entries [0..3] — Float32 bit patterns
 *                     (line-width units, recovered via
 *                     `uintBitsToFloat` in the shader).
 *   - `base + 4..6`  pattern entries [4..6].
 *   - `base + 7`     pattern entry [7] in the high bits…
 *                     and pattern length `[0..8]` in the low
 *                     byte of the eighth slot? No — keep it
 *                     simple and store len in a third half-texel.
 *
 * In practice we use two full texels for the 8 entries and put
 * the length in the unused channel of the second texel's last
 * slot. The shader unpacks the length from the same u32 bit
 * pattern's high byte before reinterpreting the rest as a
 * Float32. Avoids a third texel for a single byte.
 *
 * Concrete layout adopted here — eight slots wide:
 *   - `base + 0`  entry[0] (Float32 bits)
 *   - `base + 1`  entry[1]
 *   - `base + 2`  entry[2]
 *   - `base + 3`  entry[3]
 *   - `base + 4`  entry[4]
 *   - `base + 5`  entry[5]
 *   - `base + 6`  entry[6]
 *   - `base + 7`  entry[7]
 *
 * Pattern length is *not* stored here — it's reconstructed in
 * the shader by counting trailing-zero entries (zero-padded by
 * the CPU encoder). That keeps the texel-per-slot count to
 * exactly two RGBA32UI texels.
 *
 * @internal
 */
export class LinePatternTexture extends ItemDataTexture {

  static readonly itemSizeInBytes = 32; // 2 × uvec4 per slot

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number;
    description?: string;
    getNumItems: () => number;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RGBA_INTEGER,
      type: options.gl.UNSIGNED_INT,
      internalFormat: options.gl.RGBA32UI,
      maxItems: options.maxItems,
      getNumItems: options.getNumItems,
      width: 256,                                       // 256 × N rows; 32-slot table fits in two rows
      itemSizeInBytes: LinePatternTexture.itemSizeInBytes,
      texelsPerItem: 2,
      elementsPerTexel: 4,
      useBuffer: true,
    });
  }

  /**
   * Writes the eight pattern entries for `slotIndex` as raw
   * Float32 bit patterns. Trailing entries past `entries.length`
   * (or past index 7) are zero-padded so the shader can sum the
   * full 8-entry array to recover the period without consulting
   * a separate length.
   *
   * Slot 0 is the "no pattern" sentinel and should not be
   * written — callers allocate slots starting at index 1.
   */
  setSlot(slotIndex: number, entries: Float32Array): void {
    const base = slotIndex * this.elementsPerItem;
    for (let i = 0; i < 8; i++) {
      this.buffer[base + i] = floatBitsToU32(i < entries.length ? entries[i] : 0);
    }
    this.setItemDirty(slotIndex);
  }

  /**
   * Read-back helper — not used by the renderer but required by
   * the abstract base class. Returns the eight pattern entries
   * for `slotIndex` as a plain `number[]`.
   */
  getItem(slotIndex: number): number[] {
    const base = slotIndex * this.elementsPerItem;
    const out: number[] = [];
    for (let i = 0; i < 8; i++) {
      out.push(u32ToFloatBits(this.buffer[base + i] >>> 0));
    }
    return out;
  }
}

const _floatBitsToU32_buf = new ArrayBuffer(4);
const _floatBitsToU32_f32 = new Float32Array(_floatBitsToU32_buf);
const _floatBitsToU32_u32 = new Uint32Array(_floatBitsToU32_buf);

function floatBitsToU32(f: number): number {
  _floatBitsToU32_f32[0] = f;
  return _floatBitsToU32_u32[0];
}

function u32ToFloatBits(u: number): number {
  _floatBitsToU32_u32[0] = u;
  return _floatBitsToU32_f32[0];
}
