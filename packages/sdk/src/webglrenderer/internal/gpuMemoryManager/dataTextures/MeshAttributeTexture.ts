import { ItemDataTexture } from "./ItemDataTexture";

type MeshAttributeItem = {
  tileIndex: number;
  geometryIndex: number;
};

const data = new Uint32Array(4);

/**
 * Stores per-mesh attributes like tile index and geometry index.
 */
export class MeshAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 16; // 4 x uint32 per uvec4

  private dirty: boolean;
  private readonly itemCache: MeshAttributeItem[];

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number;
    description?: string;
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
      itemSizeInBytes: MeshAttributeTexture.itemSizeInBytes,
      texelsPerItem: 1,
      elementsPerTexel: 4,
      useBuffer: false
    });

    this.dirty = false;
    this.itemCache = new Array(options.maxItems);

    for (let i = 0; i < options.maxItems; i++) {
      this.itemCache[i] = {
        tileIndex: 0,
        geometryIndex: 0,
      };
    }
  }

  setItem(itemIndex: number, item: { tileIndex?: number; geometryIndex?: number }): void {
    const cached = this.itemCache[itemIndex];
    if (!cached) {
      throw new Error(`[MeshAttributeTexture.setItem] Item index out of range: ${itemIndex}`);
    }

    if (item.tileIndex !== undefined) {
      cached.tileIndex = this.toU32(item.tileIndex);
    }

    if (item.geometryIndex !== undefined) {
      cached.geometryIndex = this.toU32(item.geometryIndex);
    }

    const x = itemIndex % this.width;
    const y = Math.floor(itemIndex / this.width);

    data[0] = cached.tileIndex;
    data[1] = cached.geometryIndex;
    data[2] = 0;
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

  getItem(itemIndex: number): { tileIndex: number; geometryIndex: number } {
    const cached = this.itemCache[itemIndex];
    if (!cached) {
      throw new Error(`[MeshAttributeTexture.getItem] Item index out of range: ${itemIndex}`);
    }

    return {
      tileIndex: cached.tileIndex,
      geometryIndex: cached.geometryIndex,
    };
  }

  public uploadChanges(): boolean {
    return false;
    // if (!this.dirty) {
    //   return false;
    // }
    //
    // this.dirty = false;
    // this.notifyUpdated();
    // return true;
  }

  private toU32(x: number): number {
    return typeof x === "bigint" ? Number(x & 0xFFFFFFFFn) : (x >>> 0);
  }
}