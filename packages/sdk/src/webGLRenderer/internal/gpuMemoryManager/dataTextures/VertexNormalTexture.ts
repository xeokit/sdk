import {PortionDataTexture} from "./PortionDataTexture";
import {type Vec2} from "../../../../math/vector";

/**
 * Data texture that stores octahedral-encoded vertex normals as RG uint16
 * pairs.
 *
 * One pair (4 bytes) per vertex. The encoder remaps the unit-length signed
 * octahedral coordinates from `[-1, 1]` to `[0, 65535]` so the data fits a
 * single RG16UI texel; the matching shader-side decoder is in
 * {@link DrawTechnique.vsCommonDeclarations} (`octDecodeNormalU16`).
 *
 * Allocated lazily — only batches whose `hasNormals` flag is `true` create
 * one. Flat-shaded batches keep using the `dFdx/dFdy` derived face normal
 * and pay zero cost for this texture.
 */
export class VertexNormalTexture extends PortionDataTexture {

  /**
   * The size of each item in bytes — two uint16 values per vertex.
   */
  public static readonly itemSizeInBytes = 4;

  /**
   * @private
   */
  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number; // number of items (vertices)
    description: string;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RG_INTEGER,
      type: options.gl.UNSIGNED_SHORT,
      internalFormat: options.gl.RG16UI,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      width: 4096,
      itemSizeInBytes: VertexNormalTexture.itemSizeInBytes,
      texelsPerItem: 1,
      elementsPerTexel: 2,
    });
  }

  /**
   * Returns the octahedral pair stored at the given vertex slot. Useful
   * for inspectors; the shader fetches the same texel directly.
   */
  getItem(itemIndex: number): Vec2 {
    const offset = itemIndex * this.elementsPerItem;
    return [
      this.buffer[offset],
      this.buffer[offset + 1]
    ];
  }
}
