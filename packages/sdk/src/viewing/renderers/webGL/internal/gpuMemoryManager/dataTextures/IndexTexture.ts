import {PortionDataTexture} from "./PortionDataTexture";

export class IndexTexture extends PortionDataTexture {

  public static readonly itemSizeInBytes = 4; // 1 × uint32 per item

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
      format: options.gl.RED_INTEGER,
      type: options.gl.UNSIGNED_INT,
      internalFormat: options.gl.R32UI,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      width: 4096,
      itemSizeInBytes: IndexTexture.itemSizeInBytes, // 1 × uint32 per item
      texelsPerItem: 1,    // 1 R32UI texel per item
      elementsPerTexel: 1 // R32UI
    });
  }

  getItem(itemIndex: number): number {
    const offset = itemIndex * this.elementsPerItem;
    return this.buffer[offset];
  }
}
