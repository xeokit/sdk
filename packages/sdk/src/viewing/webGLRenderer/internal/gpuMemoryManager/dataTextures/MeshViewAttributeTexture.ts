import type { Vec3 } from "../../../../../base/math/vector";
import { ItemDataTexture } from "./ItemDataTexture";

/**
 * Stores per-view-mesh attributes: color, opacity, pickability, clippability.
 */
export class MeshViewAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 16; // 4 × uint32 per uvec4

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
      type: options.gl.UNSIGNED_BYTE,
      internalFormat: options.gl.RGBA8UI,
      maxItems: options.maxItems,
      getNumItems: options.getNumItems,
      width: 4096,
      itemSizeInBytes: MeshViewAttributeTexture.itemSizeInBytes,
      texelsPerItem: 2,
      elementsPerTexel: 4,
    });
  }

  setItem(itemIndex: number, item: {
    color?: Vec3;
    /** Opacity in range [0..255] */
    opacity?: number;
    pickable?: boolean;
    clippable?: boolean;
  }): void {
    const base = itemIndex * this.elementsPerItem;
    const buf = this.buffer;
    if (item.color) {
      buf[base] = item.color[0];
      buf[base + 1] = item.color[1];
      buf[base + 2] = item.color[2];
    }
    if (item.opacity !== undefined) buf[base + 3] = item.opacity;
    if (item.pickable !== undefined) buf[base + 4] = item.pickable ? 1 : 0;
    if (item.clippable !== undefined) buf[base + 5] = item.clippable ? 1 : 0;
    this.setItemDirty(itemIndex);
  }

  getItem(itemIndex: number): {
    color: Vec3;
    opacity: number;
    pickable: boolean;
    clippable: boolean;
  } {
    const base = itemIndex * this.elementsPerItem;
    const buf = this.buffer;
    return {
      color: [buf[base], buf[base + 1], buf[base + 2]],
      opacity: buf[base + 3],
      pickable: buf[base + 4] !== 0,
      clippable: buf[base + 5] !== 0,
    };
  }
}
