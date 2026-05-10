import {createMat4Float64, type Mat4} from "../../../../math/matrix";
import {ItemDataTexture} from "./ItemDataTexture";

/**
 * Stores per-item 4x4 matrices.
 */
export class MatrixTexture extends ItemDataTexture {

  static readonly itemSizeInBytes = 64; // 16 floats x 4 bytes

  private dirty: boolean;

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
      texelsPerItem: 4,      // 4 RGBA texels = 16 floats = 1 mat4
      elementsPerTexel: 4,
      useBuffer: false
    });
    this.dirty = false;
  }

  /**
   * Sets the matrix for the given item index.
   */
  setItem(itemIndex: number, matrix: Mat4): void {
    const gl = this.gl;

    const data = matrix instanceof Float32Array ? matrix : new Float32Array(matrix);

    if (data.length !== 16) {
      throw new Error(`[MatrixTexture.setItem] Expected matrix with 16 elements, got ${data.length}`);
    }

    // Optional but recommended: keep CPU-side buffer in sync if ItemDataTexture uses one.
    //this.buffer.set(data, itemIndex * this.elementsPerItem);

    const texelIndex = itemIndex * this.texelsPerItem;
    const x = texelIndex % this.width;
    const y = Math.floor(texelIndex / this.width);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        x,
        y,
        4, // 4 texels wide
        1, // 1 texel high
        this.format,
        this.type,
        data
    );

  //  gl.bindTexture(gl.TEXTURE_2D, null);

    this.dirty = true;
  }

  /**
   * Gets the matrix for the given item index.
   */
  getItem(itemIndex: number): { matrix: Mat4 } {
    const offset = itemIndex * this.elementsPerItem;
    return {
      matrix: createMat4Float64(this.buffer.subarray(offset, offset + 16)),
    };
  }

  public uploadChanges(): boolean {
    if (!this.dirty) {
      return false;
    }

    this.dirty = false;
    this.notifyUpdated();
    return true;
  }
}