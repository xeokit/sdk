import {type Vec3} from "../../../../math";
import {ItemDataTexture} from "./ItemDataTexture";

/**
 * Stores per-geometry quantization range data (offset and scale).
 */
export class DTXGeometryQuantRangeTable extends ItemDataTexture {
  static readonly itemSizeInBytes = 32; // 8 × float per item

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number;
    description: string;
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
      width: 2048,
      itemSizeInBytes: DTXGeometryQuantRangeTable.itemSizeInBytes,
      texelsPerItem: 2,
      elementsPerTexel: 4,
    });
  }

  setItem(itemIndex: number, item: { offset: Vec3; scale: Vec3 }): void {
    const base = itemIndex * this.elementsPerItem;
    this.buffer[base + 0] = +item.offset[0];
    this.buffer[base + 1] = +item.offset[1];
    this.buffer[base + 2] = +item.offset[2];
    this.buffer[base + 3] = 0.0;
    this.buffer[base + 4] = +item.scale[0];
    this.buffer[base + 5] = +item.scale[1];
    this.buffer[base + 6] = +item.scale[2];
    this.buffer[base + 7] = 0.0;
    this.setItemDirty(itemIndex);
  }

  getItem(itemIndex: number): { offset: Vec3; scale: Vec3 } {
    const base = itemIndex * this.elementsPerItem;
    return {
      offset: [
        this.buffer[base + 0],
        this.buffer[base + 1],
        this.buffer[base + 2],
      ],
      scale: [
        this.buffer[base + 4],
        this.buffer[base + 5],
        this.buffer[base + 6],
      ],
    };
  }
}
