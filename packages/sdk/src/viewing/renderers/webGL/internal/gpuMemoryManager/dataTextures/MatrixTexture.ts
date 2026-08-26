import {createMat4Float64, type Mat4} from "../../../../../../base/math/matrix";
import {ItemDataTexture} from "./ItemDataTexture";

/**
 * Stores per-item 4x4 matrices.
 *
 * Writes are staged into the inherited CPU-side `buffer` and flushed
 * to the GPU as a coalesced `texSubImage2D` via the parent's
 * {@link ItemDataTexture.uploadChanges}. A bulk SceneModel load that
 * touches every mesh's matrix once therefore costs one GL upload per
 * render cycle, not one per mesh.
 *
 * The legacy immediate-write path can be re-enabled at runtime by
 * setting {@link MatrixTexture.useDeferredUpload} `= false` before
 * any `MatrixTexture` is constructed. The toggle exists so the load-
 * pipeline benchmark can A/B the deferred path against the legacy
 * one in a single browser session, without rebuilding. Production
 * code should leave it on.
 *
 * @internal
 */
export class MatrixTexture extends ItemDataTexture {

  static readonly itemSizeInBytes = 64; // 16 floats x 4 bytes

  /**
   * Construction-time switch between the deferred-upload path
   * (default, `true`) and the legacy immediate-`texSubImage2D` path.
   * Read once per instance in the constructor — changing it later
   * has no effect on already-constructed textures.
   *
   * Also honours the global `XEOKIT_MATRIX_DEFER_UPLOAD` (boolean) on
   * `globalThis`/`window` when present, so benchmark harnesses can
   * flip the mode before importing the SDK without taking a static
   * reference to this internal class.
   *
   * @internal
   */
  static useDeferredUpload = true;

  private readonly _deferred: boolean;
  private _immediateDirty = false;

  constructor(options: {
    gl: WebGL2RenderingContext;
    maxItems?: number;
    getNumItems: () => number;
    description?: string;
  }) {
    const override = (globalThis as any).XEOKIT_MATRIX_DEFER_UPLOAD;
    const deferred = typeof override === "boolean"
      ? override
      : MatrixTexture.useDeferredUpload;
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RGBA,
      type: options.gl.FLOAT,
      internalFormat: options.gl.RGBA32F,
      maxItems: options.maxItems,
      getNumItems: options.getNumItems,
      width: 4096,
      itemSizeInBytes: MatrixTexture.itemSizeInBytes,
      texelsPerItem: 4,      // 4 RGBA texels = 16 floats = 1 mat4
      elementsPerTexel: 4,
      // Deferred path needs the CPU staging buffer; immediate path
      // writes straight to the GPU and never reads back.
      useBuffer: deferred,
    });
    this._deferred = deferred;
  }

  setItem(itemIndex: number, matrix: Mat4): void {
    if (matrix.length !== 16) {
      throw new Error(`[MatrixTexture.setItem] Expected matrix with 16 elements, got ${matrix.length}`);
    }

    if (this._deferred) {
      const buf = this.buffer as Float32Array;
      const base = itemIndex * 16;
      // Float32 input takes the typed-array fast path; Float64 / plain
      // arrays fall through to the element-wise copy.
      if (matrix instanceof Float32Array) {
        buf.set(matrix, base);
      } else {
        for (let i = 0; i < 16; i++) buf[base + i] = matrix[i];
      }
      this.setItemDirty(itemIndex);
      return;
    }

    // Legacy immediate-write path — one gl.texSubImage2D per call.
    const gl = this.gl;
    const data = matrix instanceof Float32Array ? matrix : new Float32Array(matrix);
    const texelIndex = itemIndex * this.texelsPerItem;
    const x = texelIndex % this.width;
    const y = Math.floor(texelIndex / this.width);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        x,
        y,
        4,
        1,
        this.format,
        this.type,
        data,
    );
    this._immediateDirty = true;
  }

  getItem(itemIndex: number): { matrix: Mat4 } {
    if (!this._deferred) {
      // No CPU buffer to read back from in immediate mode. The legacy
      // override had the same defect (silently returning garbage); throw
      // explicitly so callers see the mode mismatch.
      throw new Error("[MatrixTexture.getItem] unavailable when useDeferredUpload=false");
    }
    const offset = itemIndex * this.elementsPerItem;
    return {
      matrix: createMat4Float64(this.buffer.subarray(offset, offset + 16)),
    };
  }

  public uploadChanges(): boolean {
    if (this._deferred) {
      return super.uploadChanges();
    }
    if (!this._immediateDirty) return false;
    this._immediateDirty = false;
    this.notifyUpdated();
    return true;
  }
}
