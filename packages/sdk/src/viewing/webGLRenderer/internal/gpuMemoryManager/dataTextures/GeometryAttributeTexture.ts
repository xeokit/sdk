import { ItemDataTexture } from "./ItemDataTexture";

/**
 * Stores per-geometry attributes such as base addresses for vertex, index, and edge index data.
 *
 * Two texels per geometry, eight u32 slots total:
 *  - texel 0: `(verticesBase, indicesBase, edgeIndicesBase, normalsBase)`
 *  - texel 1: `(uvsBase,      polylineCumDistBase, vertexColorsBase, reserved)`
 *
 * Each `*Base` is `0` when the corresponding attribute isn't allocated
 * for that geometry; the shader only reads a slot when its containing
 * batch was compiled with the matching variant flag (`hasNormals`,
 * `hasUVs`, etc.) — so the zero is harmless.
 *
 * Directly uploads each item into the texture.
 *
 * @internal
 */
export class GeometryAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 32; // 2 x uvec4 per geometry

  constructor(options: {
    gl: WebGL2RenderingContext;
    description: string;
    maxItems: number;
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
      itemSizeInBytes: GeometryAttributeTexture.itemSizeInBytes,
      texelsPerItem: 2,
      elementsPerTexel: 4,
      useBuffer: true
    });
  }


  /**
   * Sets the attribute data for a specific geometry item.
   *
   * Slot layout (linearised — `base` is `itemIndex * elementsPerItem`):
   *   - `base + 0` verticesBase
   *   - `base + 1` indicesBase
   *   - `base + 2` edgeIndicesBase
   *   - `base + 3` normalsBase
   *   - `base + 4` uvsBase
   *   - `base + 5` polylineCumDistBase — base offset into the per-batch
   *                {@link "./PolylineCumDistTexture".PolylineCumDistTexture}
   *                for the geometry's per-segment cumulative-model-distance
   *                values. `0` for non-`LinesPrimitive` geometries (and
   *                for line geometries whose batch never allocated a
   *                polyline-cum-dist texture).
   *   - `base + 6` vertexColorsBase
   *   - `base + 7` reserved
   *
   * @param itemIndex
   * @param item
   */
  setItem(itemIndex: number, item: {
    verticesBase?: number;
    indicesBase?: number;
    edgeIndicesBase?: number;
    normalsBase?: number;
    uvsBase?: number;
    polylineCumDistBase?: number;
    vertexColorsBase?: number;
  }): void {
    const base = itemIndex * this.elementsPerItem;
    if (item.verticesBase !== undefined) this.buffer[base] = this.toU32(item.verticesBase);
    if (item.indicesBase !== undefined) this.buffer[base + 1] = this.toU32(item.indicesBase);
    if (item.edgeIndicesBase !== undefined) this.buffer[base + 2] = this.toU32(item.edgeIndicesBase);
    if (item.normalsBase !== undefined) this.buffer[base + 3] = this.toU32(item.normalsBase);
    if (item.uvsBase !== undefined) this.buffer[base + 4] = this.toU32(item.uvsBase);
    if (item.polylineCumDistBase !== undefined) this.buffer[base + 5] = this.toU32(item.polylineCumDistBase);
    if (item.vertexColorsBase !== undefined) this.buffer[base + 6] = this.toU32(item.vertexColorsBase);
    this.setItemDirty(itemIndex);
  }

  getItem(_itemIndex: number): { verticesBase: number; indicesBase: number; edgeIndicesBase: number; normalsBase: number; uvsBase: number; vertexColorsBase: number } {
    throw new Error("[GeometryAttributeTexture.getItem] Not supported without backing state");
  }

  private toU32(x: number): number {
    return typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);
  }
}
