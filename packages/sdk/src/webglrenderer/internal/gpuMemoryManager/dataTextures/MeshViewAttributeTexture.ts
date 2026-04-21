import type { Vec3 } from "../../../../math/vector";
import { ItemDataTexture } from "./ItemDataTexture";

type MeshViewAttributeItem = {
  color: Vec3;
  opacity: number;
  pickable: boolean;
  clippable: boolean;
};

const data = new Uint8Array(8);

/**
 * Stores per-view-mesh attributes: color, opacity, pickability, clippability.
 *
 * This version:
 * - does not use the ItemDataTexture backing buffer for writes
 * - uploads each changed item directly into the GPU texture
 * - supports partial updates via a small per-item JS cache
 * - uses a dirty flag and uploadChanges() like MatrixTexture
 */
export class MeshViewAttributeTexture extends ItemDataTexture {
  static readonly itemSizeInBytes = 16; // preserved to match existing texture sizing assumptions

  private dirty: boolean;
  private readonly itemCache: MeshViewAttributeItem[];

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
      type: options.gl.UNSIGNED_BYTE,
      internalFormat: options.gl.RGBA8UI,
      maxItems: options.maxItems,
      getNumItems: options.getNumItems,
      width: 4096,
      itemSizeInBytes: MeshViewAttributeTexture.itemSizeInBytes,
      texelsPerItem: 2,
      elementsPerTexel: 4,
      useBuffer: false
    });

    this.dirty = false;
    this.itemCache = new Array(options.maxItems);

    for (let i = 0; i < options.maxItems; i++) {
      this.itemCache[i] = {
        color: [0, 0, 0],
        opacity: 255,
        pickable: false,
        clippable: false,
      };
    }
  }

  setItem(itemIndex: number, item: {
    color?: Vec3;
    /** Opacity in range [0..255] */
    opacity?: number;
    pickable?: boolean;
    clippable?: boolean;
  }): void {
    const gl = this.gl;

    const cached = this.itemCache[itemIndex];
    if (!cached) {
      throw new Error(`[MeshViewAttributeTexture.setItem] Item index out of range: ${itemIndex}`);
    }

    if (item.color) {
      cached.color = [
        this.toU8(item.color[0]),
        this.toU8(item.color[1]),
        this.toU8(item.color[2]),
      ];
    }

    if (item.opacity !== undefined) {
      cached.opacity = this.toU8(item.opacity);
    }

    if (item.pickable !== undefined) {
      cached.pickable = !!item.pickable;
    }

    if (item.clippable !== undefined) {
      cached.clippable = !!item.clippable;
    }

    const itemsPerRow = Math.floor(this.width / this.texelsPerItem);
    const x = (itemIndex % itemsPerRow) * this.texelsPerItem;
    const y = Math.floor(itemIndex / itemsPerRow);

    data[0] = cached.color[0];
    data[1] = cached.color[1];
    data[2] = cached.color[2];
    data[3] = cached.opacity;
    data[4] = cached.pickable ? 1 : 0;
    data[5] = cached.clippable ? 1 : 0;
    data[6] = 0;
    data[7] = 0;

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
 //   gl.bindTexture(gl.TEXTURE_2D, null);

    this.dirty = true;
  }

  getItem(itemIndex: number): {
    color: Vec3;
    opacity: number;
    pickable: boolean;
    clippable: boolean;
  } {
    const cached = this.itemCache[itemIndex];
    if (!cached) {
      throw new Error(`[MeshViewAttributeTexture.getItem] Item index out of range: ${itemIndex}`);
    }

    return {
      color: [cached.color[0], cached.color[1], cached.color[2]],
      opacity: cached.opacity,
      pickable: cached.pickable,
      clippable: cached.clippable,
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

  private toU8(x: number): number {
    return Math.max(0, Math.min(255, x | 0));
  }
}