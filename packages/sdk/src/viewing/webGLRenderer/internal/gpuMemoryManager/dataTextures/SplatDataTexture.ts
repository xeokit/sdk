import {PortionDataTexture} from "./PortionDataTexture";
import {SPLAT_FLOATS_PER_ITEM} from "../../../../../formats/gaussiansplat/utils/packSplats";

/**
 * Data texture holding the per-splat GPU record produced by {@link packSplats} —
 * 4 × RGBA32F texels per splat (centre+opacity, colour, covariance rows a/b).
 *
 * A {@link PortionDataTexture} subclass, so gaussian-splat geometries stream in
 * and out as freeable portions exactly like mesh vertex data.
 */
export class SplatDataTexture extends PortionDataTexture {

  /** 16 float32 = 64 bytes per splat (4 RGBA32F texels). */
  public static readonly itemSizeInBytes = SPLAT_FLOATS_PER_ITEM * 4;

  constructor(options: { gl: WebGL2RenderingContext; maxItems: number; description: string }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RGBA,
      type: options.gl.FLOAT,
      internalFormat: options.gl.RGBA32F,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      width: 4096,
      itemSizeInBytes: SplatDataTexture.itemSizeInBytes,
      texelsPerItem: 4,     // 4 RGBA32F texels per splat
      elementsPerTexel: 4,  // RGBA
    });
  }

  /** Returns the packed 16-float record for the splat at `itemIndex`. */
  getItem(itemIndex: number): number[] {
    const offset = itemIndex * this.elementsPerItem;
    const out: number[] = new Array(SPLAT_FLOATS_PER_ITEM);
    for (let i = 0; i < SPLAT_FLOATS_PER_ITEM; i++) {
      out[i] = this.buffer[offset + i];
    }
    return out;
  }
}
