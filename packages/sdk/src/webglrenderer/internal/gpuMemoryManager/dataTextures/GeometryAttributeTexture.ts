import { ItemDataTexture } from "./ItemDataTexture";

const data = new Uint32Array(4);

/**
 * Stores per-geometry attributes such as base addresses for vertex, index, and edge index data.
 *
 * Directly uploads each item into the texture.
 *
 * @internal
 */
export class GeometryAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 16; // 4 x uint32 per uvec4

  private dirty: boolean;

  constructor(options: {
    gl: WebGL2RenderingContext;
    description: string;
    maxItems: number;
    getNumItems: () => number;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RGBA_INTEGER,
      type: options.gl.UNSIGNED_INT,
      internalFormat: options.gl.RGBA32UI,
      maxItems: options.maxItems,
      getNumItems: options.getNumItems,
      width: 4096,
      itemSizeInBytes: GeometryAttributeTexture.itemSizeInBytes,
      texelsPerItem: 1,
      elementsPerTexel: 4,
      useBuffer: false
    });
    this.dirty = false;
  }

  setItem(itemIndex: number, item: {
    verticesBase: number;
    indicesBase: number;
    edgeIndicesBase: number;
  }): void {
    const x = itemIndex % this.width;
    const y = Math.floor(itemIndex / this.width);

    data[0] = this.toU32(item.verticesBase);
    data[1] = this.toU32(item.indicesBase);
    data[2] = this.toU32(item.edgeIndicesBase);
    data[3] = 0;

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        x,
        y,
        1,
        1,
        this.format,
        this.type,
        data
    );
  //  gl.bindTexture(gl.TEXTURE_2D, null);

    this.dirty = true;
  }

  getItem(_itemIndex: number): { verticesBase: number; indicesBase: number; edgeIndicesBase: number } {
    throw new Error("[GeometryAttributeTexture.getItem] Not supported without backing state");
  }

  public uploadChanges(): boolean {
    if (!this.dirty) {
      return false;
    }
    this.dirty = false;
    this.notifyUpdated();
    return true;
  }

  private toU32(x: number): number {
    return typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);
  }
}