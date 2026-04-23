import { ItemDataTexture } from "./ItemDataTexture";

/**
 * Stores per-mesh attributes like tile index and geometry index.
 */
export class MeshAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 16; // 4 x uint32 per uvec4

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
      texelsPerItem: 1,
      elementsPerTexel: 4,
      useBuffer: true
    });
   }

setItem(itemIndex: number, item: { tileIndex?: number; geometryIndex?: number }): void {
  const base = itemIndex * this.elementsPerItem;
  if (item.tileIndex !== undefined) this.buffer[base] = this.toU32(item.tileIndex);
if (item.geometryIndex !== undefined) this.buffer[base + 1] = this.toU32(item.geometryIndex);
this.setItemDirty(itemIndex);
}

getItem(itemIndex: number): { tileIndex: number; geometryIndex: number } {
  const base = itemIndex * this.elementsPerItem;
  return {
    tileIndex: this.buffer[base],
    geometryIndex: this.buffer[base + 1],
  };
}

private toU32(x: number): number {
  return typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);
}
}
