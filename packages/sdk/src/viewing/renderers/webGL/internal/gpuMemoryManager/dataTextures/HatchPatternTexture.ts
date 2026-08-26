import {ItemDataTexture} from "./ItemDataTexture";

/**
 * Stores per-slot hatch patterns for hatching on triangle-
 * surface meshes.
 *
 * Ten RGBA32F texels per slot. Each of the four families
 * spans two consecutive texels, followed by the shared ink
 * colour and the shared flags texel:
 *
 *   - `base + 0`   — family 0a: `(cos(angle), sin(angle), spacing, lineWidth)`
 *   - `base + 1`   — family 0b: `(typeId, phase, param1, param2)`
 *   - `base + 2`   — family 1a
 *   - `base + 3`   — family 1b
 *   - `base + 4`   — family 2a
 *   - `base + 5`   — family 2b
 *   - `base + 6`   — family 3a
 *   - `base + 7`   — family 3b
 *   - `base + 8`   — hatch ink colour `(r, g, b, opacity)`
 *   - `base + 9`   — flags `(space, 0, 0, 0)`
 *
 * `typeId` is `0`=line, `1`=dot, `2`=wavy, `3`=brick. `param1`
 * and `param2` carry the type-specific extras (amplitude /
 * wavelength for wavy; brickHeight / courseOffset for brick).
 *
 * The CPU encoder zero-pads unused trailing families so the
 * shader's loop is bounded and branch-free; `spacing == 0`
 * still serves as the "this slot is unused" sentinel.
 *
 * Slot 0 is reserved as the "no hatch" sentinel — meshes whose
 * materials carry no hatch leave their `hatchPatternSlot` at 0,
 * and the surface technique skips the lookup entirely.
 *
 * @internal
 */
export class HatchPatternTexture extends ItemDataTexture {

  static readonly itemSizeInBytes = 160; // 10 × vec4 per slot

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number;
    description?: string;
    getNumItems: () => number;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RGBA,
      type: options.gl.FLOAT,
      internalFormat: options.gl.RGBA32F,
      maxItems: options.maxItems,
      getNumItems: options.getNumItems,
      width: 256,                                       // 10-texel slots, 256-wide row fits ~25 slots
      itemSizeInBytes: HatchPatternTexture.itemSizeInBytes,
      texelsPerItem: 10,
      elementsPerTexel: 4,
      useBuffer: true,
    });
  }

  /**
   * Writes the four families' parameter pairs, the ink colour,
   * and the flags texel for `slotIndex`.
   *
   * `families` is expected to be `MAX_HATCH_FAMILIES × 8` floats
   * long — two texels per family (see the class doc-comment).
   * `color` is `(r, g, b, opacity)`; `space` is `0` for
   * screen-space, `1` for world-space, `2` for tangent-space.
   *
   * Slot 0 is the "no hatch" sentinel and should not be written
   * — callers allocate slots starting at index 1.
   */
  setSlot(
    slotIndex: number,
    families: Float32Array,
    color: Float32Array,
    space: number,
  ): void {
    const base = slotIndex * this.elementsPerItem;
    const buf: Float32Array = this.buffer;
    // 32 family floats — 8 RGBA32F texels (2 per family).
    for (let i = 0; i < 32; i++) {
      buf[base + i] = i < families.length ? families[i] : 0;
    }
    // 4 colour floats — one RGBA32F texel.
    buf[base + 32] = color[0];
    buf[base + 33] = color[1];
    buf[base + 34] = color[2];
    buf[base + 35] = color[3];
    // 4 flag floats — one RGBA32F texel. r = space; rest reserved.
    buf[base + 36] = space;
    buf[base + 37] = 0;
    buf[base + 38] = 0;
    buf[base + 39] = 0;
    this.setItemDirty(slotIndex);
  }

  /**
   * Read-back helper — not used by the renderer but required by
   * the abstract base class. Returns the 40 raw floats for
   * `slotIndex` (32 family + 4 colour + 4 flags).
   */
  getItem(slotIndex: number): number[] {
    const base = slotIndex * this.elementsPerItem;
    const buf: Float32Array = this.buffer;
    const out: number[] = [];
    for (let i = 0; i < 40; i++) {
      out.push(buf[base + i]);
    }
    return out;
  }
}
