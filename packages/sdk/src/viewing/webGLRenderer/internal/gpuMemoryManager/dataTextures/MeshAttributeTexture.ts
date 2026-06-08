import { ItemDataTexture } from "./ItemDataTexture";

/**
 * Stores per-mesh attributes shared across views — tile + geometry indices,
 * Cook-Torrance material parameters, and one UV transform per PBR-map type.
 *
 * Five texels per mesh, twenty u32 slots total (linearised — `base` is
 * `itemIndex * elementsPerItem`):
 *   - `base + 0`  tileIndex
 *   - `base + 1`  geometryIndex
 *   - `base + 2`  PBR material + hatch slot — bits 0-7 are
 *                 `roughness` (u8), bits 8-15 are `metallic`
 *                 (u8), bits 16-31 are `hatchPatternSlot`
 *                 (`0` = no hatch, `> 0` = index into the
 *                 per-batch
 *                 {@link "./HatchPatternTexture".HatchPatternTexture})
 *   - `base + 3`  alpha + line-pattern slot — bits 0-7 are `alphaMode`
 *                 (`0 = OPAQUE`, `1 = MASK`, `2 = BLEND`), bits 8-15 are
 *                 `alphaCutoff` (u8 normalised to `[0, 255]`), and bits
 *                 16-31 are `linePatternSlot` (`0` = no per-mesh pattern,
 *                 fall back to the View's `linesMaterial.linePattern`;
 *                 `> 0` = index into the per-batch
 *                 {@link "./LinePatternTexture".LinePatternTexture} where
 *                 the material's pattern entries are written)
 *   - `base + 4`  packed albedo `(uOffset, vOffset)` — two u16s, R = lo
 *   - `base + 5`  packed albedo `(uScale,  vScale)`  — two u16s, R = lo
 *   - `base + 6`  packed metallic-roughness `(uOffset, vOffset)`
 *   - `base + 7`  packed metallic-roughness `(uScale,  vScale)`
 *   - `base + 8`  packed normal-map `(uOffset, vOffset)`
 *   - `base + 9`  packed normal-map `(uScale,  vScale)`
 *   - `base + 10` triplanar repeat distance — Float32 bit pattern reinterpret
 *                 (read in the shader via `uintBitsToFloat`). Consumed only
 *                 by the triplanar shader variant; UV-bearing batches ignore
 *                 it.
 *   - `base + 11` per-mesh line thickness in screen pixels — Float32
 *                 bit pattern reinterpret. Consumed by the thick-line
 *                 draw technique; `0` falls back to the View's
 *                 `linesMaterial.lineWidth`.
 *   - `base + 12` packed emissive `(uOffset, vOffset)`
 *   - `base + 13` packed emissive `(uScale,  vScale)`
 *   - `base + 14` packed occlusion `(uOffset, vOffset)`
 *   - `base + 15` packed occlusion `(uScale,  vScale)`
 *   - `base + 16` emissive colour factor — RGB8 (`r | g<<8 | b<<16`). The
 *                 emissive atlas's white sentinel means untextured meshes
 *                 would otherwise glow; a `[0,0,0]` factor here (the default
 *                 for materials with no emissive texture) zeroes that out,
 *                 while textured materials carry `[1,1,1]` (or an explicit
 *                 factor), so emissive = factor × texture.
 *   - `base + 17..19` reserved
 *
 * Each UV transform takes per-vertex `vUV ∈ [0, 1]` to atlas-space:
 * `atlasUV = vUV * (uScale, vScale) + (uOffset, vOffset)`. Different
 * PBR maps live in separate per-batch atlases (different formats — sRGB
 * for albedo, linear for MR / normals), so each map gets its own
 * transform — artists can pack their textures independently. Untextured
 * meshes write the relevant atlas's sentinel transform (scale = 0) so
 * they collapse to a single sentinel texel without branching in the
 * shader.
 *
 * Per-material line-pattern entries live in a separate
 * {@link "./LinePatternTexture".LinePatternTexture} indexed by
 * `linePatternSlot`. Splitting them out keeps triangle / point batches
 * from paying any storage for line-only data — a slot of `0` here
 * means "no per-mesh pattern", so the renderer skips the pattern-table
 * lookup entirely.
 */
export class MeshAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 80; // 5 × uvec4 per mesh

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
      width: 4096,
      itemSizeInBytes: MeshAttributeTexture.itemSizeInBytes,
      texelsPerItem: 5,
      elementsPerTexel: 4,
      useBuffer: true
    });
   }

setItem(itemIndex: number, item: {
  tileIndex?: number;
  geometryIndex?: number;
  roughness?: number;
  metallic?: number;
  alphaMode?: number;
  alphaCutoff?: number;
  albedoUVOffset?: [number, number];
  albedoUVScale?:  [number, number];
  metallicRoughnessUVOffset?: [number, number];
  metallicRoughnessUVScale?:  [number, number];
  normalMapUVOffset?: [number, number];
  normalMapUVScale?:  [number, number];
  emissiveUVOffset?: [number, number];
  emissiveUVScale?:  [number, number];
  occlusionUVOffset?: [number, number];
  occlusionUVScale?:  [number, number];
  // Emissive colour factor in [0, 1] per channel. Multiplied against the
  // emissive texture sample in the shader. `[0,0,0]` (the default for
  // materials with no emissive texture) suppresses the white-sentinel glow.
  emissiveColor?: [number, number, number];
  triplanarScale?: number;
  lineWidth?: number;
  // Index of the slot in this batch's LinePatternTexture that
  // holds the mesh's per-material dash / gap pattern. `0`
  // means "no override — inherit the View's
  // linesMaterial.linePattern". Stored in the upper 16 bits of
  // the alpha slot (bits 16-31).
  linePatternSlot?: number;
  // Index of the slot in this batch's HatchPatternTexture that
  // holds the mesh's per-material screen-space hatch. `0`
  // means "no hatch" (default). Stored in the upper 16 bits of
  // the PBR material slot (bits 16-31; the low 16 bits hold
  // packed roughness + metallic).
  hatchPatternSlot?: number;
}): void {
  const base = itemIndex * this.elementsPerItem;
  if (item.tileIndex !== undefined) this.buffer[base] = this.toU32(item.tileIndex);
  if (item.geometryIndex !== undefined) this.buffer[base + 1] = this.toU32(item.geometryIndex);
  if (item.roughness !== undefined || item.metallic !== undefined || item.hatchPatternSlot !== undefined) {
    // Three sub-fields share base + 2 — roughness (byte 0),
    // metallic (byte 1), and the 16-bit hatch-pattern slot
    // index (bits 16-31). Read-modify-write so callers can
    // update any one of them without disturbing the others.
    const existing = this.buffer[base + 2] >>> 0;
    const r8 = item.roughness !== undefined
      ? clampU8(item.roughness * 255)
      : (existing & 0xff);
    const m8 = item.metallic !== undefined
      ? clampU8(item.metallic * 255)
      : ((existing >>> 8) & 0xff);
    const hatch16 = item.hatchPatternSlot !== undefined
      ? clampU16(item.hatchPatternSlot)
      : ((existing >>> 16) & 0xffff);
    this.buffer[base + 2] = (r8 | (m8 << 8) | (hatch16 << 16)) >>> 0;
  }
  if (item.alphaMode !== undefined || item.alphaCutoff !== undefined || item.linePatternSlot !== undefined) {
    // Three sub-fields share base + 3 — alpha mode, alpha cutoff,
    // and the 16-bit line-pattern slot index. Read-modify-write
    // so callers can update any one of them without disturbing
    // the others.
    const existing = this.buffer[base + 3] >>> 0;
    const mode8   = item.alphaMode !== undefined
      ? clampU8(item.alphaMode)
      : (existing & 0xff);
    const cutoff8 = item.alphaCutoff !== undefined
      ? clampU8(item.alphaCutoff * 255)
      : ((existing >>> 8) & 0xff);
    const slot16  = item.linePatternSlot !== undefined
      ? clampU16(item.linePatternSlot)
      : ((existing >>> 16) & 0xffff);
    this.buffer[base + 3] = (mode8 | (cutoff8 << 8) | (slot16 << 16)) >>> 0;
  }
  if (item.albedoUVOffset !== undefined) {
    this.buffer[base + 4] = packUV2(item.albedoUVOffset);
  }
  if (item.albedoUVScale !== undefined) {
    this.buffer[base + 5] = packUV2(item.albedoUVScale);
  }
  if (item.metallicRoughnessUVOffset !== undefined) {
    this.buffer[base + 6] = packUV2(item.metallicRoughnessUVOffset);
  }
  if (item.metallicRoughnessUVScale !== undefined) {
    this.buffer[base + 7] = packUV2(item.metallicRoughnessUVScale);
  }
  if (item.normalMapUVOffset !== undefined) {
    this.buffer[base + 8] = packUV2(item.normalMapUVOffset);
  }
  if (item.normalMapUVScale !== undefined) {
    this.buffer[base + 9] = packUV2(item.normalMapUVScale);
  }
  if (item.triplanarScale !== undefined) {
    // Reinterpret the float as a u32 bit pattern. The shader recovers
    // it with `uintBitsToFloat`. Avoids quantising a value the user is
    // free to pick at any magnitude.
    this.buffer[base + 10] = floatBitsToU32(item.triplanarScale);
  }
  if (item.lineWidth !== undefined) {
    // Same float-as-u32 trick as triplanarScale — pixel widths
    // are user-picked and have no sensible quantisation grid.
    this.buffer[base + 11] = floatBitsToU32(item.lineWidth);
  }
  if (item.emissiveUVOffset !== undefined) {
    this.buffer[base + 12] = packUV2(item.emissiveUVOffset);
  }
  if (item.emissiveUVScale !== undefined) {
    this.buffer[base + 13] = packUV2(item.emissiveUVScale);
  }
  if (item.occlusionUVOffset !== undefined) {
    this.buffer[base + 14] = packUV2(item.occlusionUVOffset);
  }
  if (item.occlusionUVScale !== undefined) {
    this.buffer[base + 15] = packUV2(item.occlusionUVScale);
  }
  if (item.emissiveColor !== undefined) {
    const r8 = clampU8(item.emissiveColor[0] * 255);
    const g8 = clampU8(item.emissiveColor[1] * 255);
    const b8 = clampU8(item.emissiveColor[2] * 255);
    this.buffer[base + 16] = (r8 | (g8 << 8) | (b8 << 16)) >>> 0;
  }
  this.setItemDirty(itemIndex);
}

getItem(itemIndex: number): {
  tileIndex: number;
  geometryIndex: number;
  roughness: number;
  metallic: number;
  albedoUVOffset: [number, number];
  albedoUVScale:  [number, number];
  metallicRoughnessUVOffset: [number, number];
  metallicRoughnessUVScale:  [number, number];
  normalMapUVOffset: [number, number];
  normalMapUVScale:  [number, number];
} {
  const base = itemIndex * this.elementsPerItem;
  const packedMat = this.buffer[base + 2] >>> 0;
  return {
    tileIndex: this.buffer[base],
    geometryIndex: this.buffer[base + 1],
    roughness: (packedMat & 0xff) / 255,
    metallic:  ((packedMat >>> 8) & 0xff) / 255,
    albedoUVOffset: unpackUV2(this.buffer[base + 4] >>> 0),
    albedoUVScale:  unpackUV2(this.buffer[base + 5] >>> 0),
    metallicRoughnessUVOffset: unpackUV2(this.buffer[base + 6] >>> 0),
    metallicRoughnessUVScale:  unpackUV2(this.buffer[base + 7] >>> 0),
    normalMapUVOffset: unpackUV2(this.buffer[base + 8] >>> 0),
    normalMapUVScale:  unpackUV2(this.buffer[base + 9] >>> 0),
  };
}

private toU32(x: number): number {
  return typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);
}
}

function clampU8(v: number): number {
  v = Math.round(v);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function clampU16(v: number): number {
  v = Math.round(v);
  return v < 0 ? 0 : v > 65535 ? 65535 : v;
}

/** Packs two normalised values in `[0, 1]` into a u32 — R = lo u16. */
function packUV2(uv: [number, number]): number {
  const u = clampU16(uv[0] * 65535);
  const v = clampU16(uv[1] * 65535);
  return (u | (v << 16)) >>> 0;
}

function unpackUV2(packed: number): [number, number] {
  return [(packed & 0xffff) / 65535, ((packed >>> 16) & 0xffff) / 65535];
}

/**
 * Reinterpret a JS number's IEEE-754 single-precision bit pattern as a
 * u32. Used so the shader can recover the value with `uintBitsToFloat`
 * without losing precision to a fixed-point quantisation.
 */
const _floatBitsToU32_buf = new ArrayBuffer(4);
const _floatBitsToU32_f32 = new Float32Array(_floatBitsToU32_buf);
const _floatBitsToU32_u32 = new Uint32Array(_floatBitsToU32_buf);
function floatBitsToU32(f: number): number {
  _floatBitsToU32_f32[0] = f;
  return _floatBitsToU32_u32[0];
}
