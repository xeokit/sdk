import {PortionDataTexture} from "./PortionDataTexture";
import {type Vec2} from "../../../../../../base/math/vector";

/**
 * Data texture that stores per-vertex UV coordinates as RG float32 pairs.
 *
 * One pair (8 bytes) per vertex. Storing raw floats — rather than the
 * old [0, 1]-clamped RG16UI — preserves tiling UVs (values outside
 * `[0, 1]`) intact. The shader applies a per-fragment `fract()` before
 * transforming into the mesh's atlas sub-rect, which is what makes
 * tiled materials sample correctly.
 *
 * Allocated lazily — only batches whose `hasUVs` flag is `true` create one.
 * Batches without UVs pay zero storage cost. The shader's UV-bearing
 * technique variant binds this sampler; flat-shaded and other non-UV
 * variants don't reference the texture and skip the bind.
 */
export class VertexUVTexture extends PortionDataTexture {

  /**
   * The size of each item in bytes — two float32 values per vertex.
   */
  public static readonly itemSizeInBytes = 8;

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number; // number of items (vertices)
    description: string;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RG,
      type: options.gl.FLOAT,
      internalFormat: options.gl.RG32F,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      width: 4096,
      itemSizeInBytes: VertexUVTexture.itemSizeInBytes,
      texelsPerItem: 1,
      elementsPerTexel: 2,
    });
  }

  /**
   * Returns the quantised (u, v) pair stored at the given vertex slot.
   * Inspector-only; the shader fetches the same texel via texelFetch.
   */
  getItem(itemIndex: number): Vec2 {
    const offset = itemIndex * this.elementsPerItem;
    return [
      this.buffer[offset],
      this.buffer[offset + 1]
    ];
  }
}
