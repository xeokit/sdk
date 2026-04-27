import { ItemDataTexture } from "./ItemDataTexture";

/**
 * Stores per-mesh attributes shared across views — tile + geometry indices,
 * Cook-Torrance material parameters, and one UV transform per PBR-map type.
 *
 * Three texels per mesh, twelve u32 slots total (linearised — `base` is
 * `itemIndex * elementsPerItem`):
 *   - `base + 0`  tileIndex
 *   - `base + 1`  geometryIndex
 *   - `base + 2`  PBR material — packs `(roughness, metallic, 0, 0)` as
 *                 four u8s, R = least-significant byte
 *   - `base + 3`  alpha — `(alphaMode_u8, alphaCutoff_u8, 0, 0)` where
 *                 `alphaMode` is `0 = OPAQUE`, `1 = MASK`, `2 = BLEND`
 *                 and `alphaCutoff` is normalised to `[0, 255]`
 *   - `base + 4`  packed albedo `(uOffset, vOffset)` — two u16s, R = lo
 *   - `base + 5`  packed albedo `(uScale,  vScale)`  — two u16s, R = lo
 *   - `base + 6`  packed metallic-roughness `(uOffset, vOffset)`
 *   - `base + 7`  packed metallic-roughness `(uScale,  vScale)`
 *   - `base + 8`  packed normal-map `(uOffset, vOffset)`
 *   - `base + 9`  packed normal-map `(uScale,  vScale)`
 *   - `base + 10..11` reserved — slot for occlusion / emissive when those land
 *
 * Each UV transform takes per-vertex `vUV ∈ [0, 1]` to atlas-space:
 * `atlasUV = vUV * (uScale, vScale) + (uOffset, vOffset)`. Different
 * PBR maps live in separate per-batch atlases (different formats — sRGB
 * for albedo, linear for MR / normals), so each map gets its own
 * transform — artists can pack their textures independently. Untextured
 * meshes write the relevant atlas's sentinel transform (scale = 0) so
 * they collapse to a single sentinel texel without branching in the
 * shader.
 */
export class MeshAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 48; // 3 × uvec4 per mesh

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
      texelsPerItem: 3,
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
}): void {
  const base = itemIndex * this.elementsPerItem;
  if (item.tileIndex !== undefined) this.buffer[base] = this.toU32(item.tileIndex);
  if (item.geometryIndex !== undefined) this.buffer[base + 1] = this.toU32(item.geometryIndex);
  if (item.roughness !== undefined || item.metallic !== undefined) {
    // Pack roughness + metallic into a single u32 so the shader does one
    // fetch and unpacks via bit-shifts. Falling back to whatever's already
    // in the buffer for the channel that wasn't set keeps partial updates
    // working (e.g. setting only roughness later).
    const existing = this.buffer[base + 2] >>> 0;
    const r8 = item.roughness !== undefined
      ? clampU8(item.roughness * 255)
      : (existing & 0xff);
    const m8 = item.metallic !== undefined
      ? clampU8(item.metallic * 255)
      : ((existing >>> 8) & 0xff);
    this.buffer[base + 2] = (r8 | (m8 << 8)) >>> 0;
  }
  if (item.alphaMode !== undefined || item.alphaCutoff !== undefined) {
    const existing = this.buffer[base + 3] >>> 0;
    const mode8   = item.alphaMode !== undefined
      ? clampU8(item.alphaMode)
      : (existing & 0xff);
    const cutoff8 = item.alphaCutoff !== undefined
      ? clampU8(item.alphaCutoff * 255)
      : ((existing >>> 8) & 0xff);
    this.buffer[base + 3] = (mode8 | (cutoff8 << 8)) >>> 0;
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
