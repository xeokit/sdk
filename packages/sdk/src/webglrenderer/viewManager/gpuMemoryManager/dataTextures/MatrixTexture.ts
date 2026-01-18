import { type Mat4 } from "../../../../math";
import { ItemDataTexture } from "./ItemDataTexture";

/**
 * Stores per-item 4x4 matrices.
 */
export class MatrixTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 64; // 16 × float per mat4

  /**
   * @private
   * @param options
   */
  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems?: number;
    getNumItems: () => number;
    description?: string;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RGBA,
      type: options.gl.FLOAT,
      internalFormat: options.gl.RGBA32F,
      maxItems: options.maxItems,
      getNumItems: options.getNumItems,
      width: 4096,
      itemSizeInBytes: MatrixTexture.itemSizeInBytes,
      texelsPerItem: 4,
      elementsPerTexel: 4,
    });
  }

  /**
   * Sets the matrix for the given item index.
   * @param itemIndex
   * @param matrix
   */
  setItem(itemIndex: number, matrix: Mat4): void {
    this.buffer.set(matrix, itemIndex * this.elementsPerItem);
    this.setItemDirty(itemIndex);
  }

  /**
   * Gets the matrix for the given item index.
   * @param itemIndex
   */
  getItem(itemIndex: number): { matrix: Mat4 } {
    const offset = itemIndex * this.elementsPerItem;
    return {
      matrix: Array.from(this.buffer.subarray(offset, offset + this.elementsPerItem)) as Mat4,
    };
  }
}
