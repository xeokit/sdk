import {type Vec3} from "../../../../../base/math/vector";
import {ItemDataTexture} from "./ItemDataTexture";

const data = new Float32Array(8);

/**
 * Stores per-geometry quantization range data (offset and scale).
 *
 * @internal
 */
export class GeometryQuantRangeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 32; // 8 x float per item

  private dirty: boolean;

  /**
   * @private
   * @param options
   */
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
      itemSizeInBytes: GeometryQuantRangeTexture.itemSizeInBytes,
      texelsPerItem: 2,
      elementsPerTexel: 4,
      useBuffer: false
    });
    this.dirty = false;
  }

  setItem(itemIndex: number, item: { offset: Vec3; scale: Vec3 }): void {
    const texelIndex = itemIndex * this.texelsPerItem;
    const x = texelIndex % this.width;
    const y = Math.floor(texelIndex / this.width);

    data[0] = +item.offset[0];
    data[1] = +item.offset[1];
    data[2] = +item.offset[2];
    data[3] = 0.0;
    data[4] = +item.scale[0];
    data[5] = +item.scale[1];
    data[6] = +item.scale[2];
    data[7] = 0.0;

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        x,
        y,
        2,
        1,
        this.format,
        this.type,
        data
    );
    //gl.bindTexture(gl.TEXTURE_2D, null);

    this.dirty = true;
  }

  getItem(_itemIndex: number): { offset: Vec3; scale: Vec3 } {
    throw new Error("[GeometryQuantRangeTexture.getItem] Not supported without a backing buffer");
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