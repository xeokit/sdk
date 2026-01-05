import {PortionDataTexture} from "./PortionDataTexture";
import {type Vec3} from "../../../../math";

export class DTXVertexPositions extends PortionDataTexture {

  public static readonly itemSizeInBytes = 6; // 3 × uint16 per item (RGB)

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number; // number of items (vertices)
    description: string;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RGB_INTEGER,
      type: options.gl.UNSIGNED_SHORT,
      internalFormat: options.gl.RGB16UI,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      width: 4096,
      itemSizeInBytes: DTXVertexPositions.itemSizeInBytes, // 3 × uint16 per item (RGB)
      texelsPerItem: 1,    // 1 RGB16UI texel per item
      elementsPerTexel: 3, // RGB16UI
    });
  }

  getItem(itemIndex: number): Vec3  {
    const offset = itemIndex * this.elementsPerItem;
    return [
      this.buffer[offset],
      this.buffer[offset + 1],
      this.buffer[offset + 2]
    ];
  }
}
