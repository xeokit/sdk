import type {Vec3} from "../../../../math";
import {DataTexture} from "./DataTexture";

export type DTXMeshViewAttribsItem = {
  color?: Vec3;   // uvec3 bytes 0..255
  opacity?: number; // float32
  pickable?: boolean;
  clippable?: boolean;
};

/**
 * GPU-backed array of fixed structs { color, renderFlags } (all uvec4), stored in RGBA8UI.
 * - 1 field == 1 texel (RGBA8UI)
 * - 1 struct == 2 texels
 * - Upload path uses RGBA_INTEGER / UNSIGNED_BYTE
 */
export class DTXMeshViewAttribs extends DataTexture {

  readonly maxItems: number;

  private _gl: WebGL2RenderingContext;

  // Layout (in texels, not floats)
  private static readonly TEXELS_PER_STRUCT = 2; // color, renderFlags
  private static readonly BYTES_PER_TEXEL = 4; // RGBA8UI

  // Texture geometry
   private _texelsPerRow: number;   // == width
   private _dirty = new Set<number>(); // struct indices

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems: number;
    description?: string;
  }) {
    super();
    this.description = options.description || "meshIndex -> color, opacity, pickable, clippable";
    this._gl = options.gl;
    this.maxItems = options.maxItems;
  }

  static get itemSizeInBytes() {
    return DTXMeshViewAttribs.TEXELS_PER_STRUCT * DTXMeshViewAttribs.BYTES_PER_TEXEL;
  }

  allocate(): boolean {
    // Choose a wide power-of-two for fewer rows
    this.width = 4096; // texels
    this._texelsPerRow = this.width;

    const structs = this.maxItems;
    const texelsNeeded = structs * DTXMeshViewAttribs.TEXELS_PER_STRUCT;
    this.height = Math.max(1, Math.ceil(texelsNeeded / this._texelsPerRow));

    const totalTexels = this.width * this.height;
    const totalBytes = totalTexels * DTXMeshViewAttribs.BYTES_PER_TEXEL;
    const gl = this._gl;
    const tex = gl.createTexture()!;

    if (!tex) {
      return false;
    }
    try {
      this.buffer = new Uint8Array(totalBytes);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, this.width, this.height);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (e) {
      gl.deleteTexture(tex);
      return false;
    }
    this.texture = tex;
    return true;
  }

  private getByteView(meshIndex: number): Uint8Array<any> {
    const startTexel = meshIndex * DTXMeshViewAttribs.TEXELS_PER_STRUCT;
    const byteOffset = startTexel * DTXMeshViewAttribs.BYTES_PER_TEXEL;
    return this.buffer.subarray(byteOffset, byteOffset + 2 * DTXMeshViewAttribs.BYTES_PER_TEXEL);
  }

  setAttribs(meshIndex: number, data: Partial<DTXMeshViewAttribsItem>): void {
    // console.log("Setting attribs for meshIndex:", meshIndex, data);
    const v = this.getByteView(meshIndex);
    const color = data.color; // [0..1, 0..1, 0..1]
    if (color) {
      v[0] = color[0];
      v[1] = color[1];
      v[2] = color[2];
    }
    if (data.opacity !== undefined) {
      v[3] = data.opacity; // 0..1
    }
    if (data.pickable !== undefined) {
      v[4] = data.pickable ? 1 : 0;
    }
    if (data.clippable !== undefined) {
      v[5] = data.clippable ? 1 : 0;
    }
    this._dirty.add(meshIndex);
    // console.log("Dirty indices after setAttribs:", Array.from(this._dirty));
  }

  readAtTexel(x: number, y: number): {
    color: [number, number, number];
    opacity: number;
    pickable: boolean;
    clippable: boolean;
  } {
    const structsPerRow = this.width / DTXMeshViewAttribs.TEXELS_PER_STRUCT;
    const structIndex = y * structsPerRow + Math.floor(x / DTXMeshViewAttribs.TEXELS_PER_STRUCT);
    const byteOffset = structIndex * DTXMeshViewAttribs.TEXELS_PER_STRUCT * DTXMeshViewAttribs.BYTES_PER_TEXEL;
    const v = this.buffer.subarray(byteOffset, byteOffset + DTXMeshViewAttribs.TEXELS_PER_STRUCT * DTXMeshViewAttribs.BYTES_PER_TEXEL);
    return {
      color: [v[0], v[1], v[2]],
      opacity: v[3],
      pickable:  v[4] !== 0,
      clippable: v[5] !== 0
    };
  }

  getItem(meshIndex: number): DTXMeshViewAttribsItem {
    const v = this.getByteView(meshIndex);
    return {
      color: [v[0], v[1], v[2]],
      opacity: v[3],
      pickable:  v[4] !== 0,
      clippable: v[5] !== 0
    };
  }

  uploadChanges(): boolean {
    if (this._dirty.size === 0) {
      //   console.log("No dirty indices to uploadChanges");
      return false;
    }

    this.bufferUpdated();
    //  console.log("Flushing dirty indices:", Array.from(this._dirty));

    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    for (const idx of this._dirty) {
      let startTexel = idx * DTXMeshViewAttribs.TEXELS_PER_STRUCT;
      let remainingTexels = DTXMeshViewAttribs.TEXELS_PER_STRUCT;

      while (remainingTexels > 0) {
        const row = Math.floor(startTexel / this._texelsPerRow);
        const x = startTexel % this._texelsPerRow;
        const rowLeft = this._texelsPerRow - x;
        const chunkTexels = Math.min(remainingTexels, rowLeft);

        const byteStart = (row * this._texelsPerRow + x) * DTXMeshViewAttribs.BYTES_PER_TEXEL;
        const byteEnd = byteStart + chunkTexels * DTXMeshViewAttribs.BYTES_PER_TEXEL;
        const sub = this.buffer.subarray(byteStart, byteEnd);

        // console.assert(chunkTexels > 0, "Invalid chunkTexels");
        // console.assert(sub.length > 0, "Empty subarray for texSubImage2D");

        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          x, row,
          chunkTexels, 1,
          gl.RGBA_INTEGER,
          gl.UNSIGNED_BYTE,
          sub
        );

        startTexel += chunkTexels;
        remainingTexels -= chunkTexels;
      }
    }

    this._dirty.clear();
    gl.bindTexture(gl.TEXTURE_2D, null);


    return true;
  }

  destroy(): void {
    if (this.texture) {
      this.buffer = null;
      this._gl.deleteTexture(this.texture);
    }
  }
}
