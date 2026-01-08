import {PortionDataTexture} from "./PortionDataTexture";
import type {Vec3} from "../../../../math";

/**
 * Data texture that stores vertex colors as RGB uint8 values.
 */
export class VertexColorTexture extends PortionDataTexture {

  /**
   * The size of each item in bytes.
   */
  public static readonly itemSizeInBytes = 3; // 3 × uint8 per item (RGB)

  /**
   * @private
   * @param options
   */
  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number; // number of items (vertices)
    description: string;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RGB_INTEGER,
      type: options.gl.UNSIGNED_BYTE,
      internalFormat: options.gl.RGB8UI,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      width: 4096,
      itemSizeInBytes: VertexColorTexture.itemSizeInBytes, // 3 × uint8 per item (RGB)
      texelsPerItem: 1,    // 1 RGB8UI texel per item
      elementsPerTexel: 3, // RGB8UI
    });
  }

  getItem(itemIndex: number): Vec3  {
    const offset = itemIndex * this.elementsPerItem;
    return [this.buffer[offset], this.buffer[offset + 1], this.buffer[offset + 2]];
  }
}
