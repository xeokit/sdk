import { ItemDataTexture } from "./ItemDataTexture";

/**
 * Stores per-geometry attributes such as base addresses for vertex, index, and edge index data.
 *
 * Directly uploads each item into the texture.
 *
 * @internal
 */
export class GeometryAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 16; // 4 x uint32 per uvec4

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
      texelsPerItem: 1,
      elementsPerTexel: 4,
      useBuffer: true
    });
  }


  /**
   * Sets the attribute data for a specific geometry item.
   * @param itemIndex
   * @param item
   */
  setItem(itemIndex: number, item: { verticesBase?: number; indicesBase?: number; edgeIndicesBase?: number }): void {
    const base = itemIndex * this.elementsPerItem;
    if (item.verticesBase !== undefined) this.buffer[base] = this.toU32(item.verticesBase);
    if (item.indicesBase !== undefined) this.buffer[base + 1] = this.toU32(item.indicesBase);
    if (item.edgeIndicesBase !== undefined) this.buffer[base + 2] = this.toU32(item.edgeIndicesBase);
    this.setItemDirty(itemIndex);
  }

  getItem(_itemIndex: number): { verticesBase: number; indicesBase: number; edgeIndicesBase: number } {
    throw new Error("[GeometryAttributeTexture.getItem] Not supported without backing state");
  }

  private toU32(x: number): number {
    return typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);
  }
}
