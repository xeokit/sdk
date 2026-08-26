import {type Vec3} from "../../../../../../base/math/vector";
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
      // Keep a CPU mirror: these per-geometry quant ranges decode every vertex
      // position, and a GPU-only texture cannot be rebuilt after a WebGL context
      // loss (there is no source to re-derive it from), leaving all geometry
      // collapsed at the origin. The mirror lets _allocateTexture re-upload it.
      useBuffer: true
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

    // Mirror into the CPU buffer so the data survives a context-loss/restore.
    this.buffer?.set(data, itemIndex * this.elementsPerItem);

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

  getItem(itemIndex: number): { offset: Vec3; scale: Vec3 } {
    if (!this.buffer) {
      throw new Error("[GeometryQuantRangeTexture.getItem] Not supported without a backing buffer");
    }
    const base = itemIndex * this.elementsPerItem;
    return {
      offset: [this.buffer[base], this.buffer[base + 1], this.buffer[base + 2]],
      scale: [this.buffer[base + 4], this.buffer[base + 5], this.buffer[base + 6]],
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