import {PortionDataTexture} from "./PortionDataTexture";

/**
 * Per-batch, per-line-segment cumulative model-space distance
 * along the parent polyline.
 *
 * For each line segment in a `LinesPrimitive` geometry, this
 * texture holds **the model-space distance from the polyline's
 * start to the segment's first vertex**, in geometry-local
 * coordinates. The vertex shader uses it to compute a screen-
 * space pixel offset that's added to the per-segment `alongPx`
 * before the pattern walk runs — that keeps the dash phase
 * continuous across polyline joints rather than restarting at
 * every segment.
 *
 * Allocated lazily per batch: a portion is reserved at
 * geometry-upload time for each `LinesPrimitive` geometry,
 * sized to the geometry's line count. Geometries that aren't
 * `LinesPrimitive` (triangles, points) reserve no portion;
 * batches that contain none of them never allocate this
 * texture at all.
 *
 * One `R32F` texel per segment — recovered in the shader as a
 * plain float, no `uintBitsToFloat` reinterpret needed.
 *
 * @internal
 */
export class PolylineCumDistTexture extends PortionDataTexture {

  public static readonly itemSizeInBytes = 4; // 1 × float32 per item

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number; // number of segments
    description: string;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RED,
      type: options.gl.FLOAT,
      internalFormat: options.gl.R32F,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      width: 4096,
      itemSizeInBytes: PolylineCumDistTexture.itemSizeInBytes,
      texelsPerItem: 1,
      elementsPerTexel: 1,
    });
  }

  getItem(itemIndex: number): number {
    const offset = itemIndex * this.elementsPerItem;
    return this.buffer[offset];
  }
}
