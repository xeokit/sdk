import {type FloatArrayParam, type Mat4} from "../../../../math";
import {DataTexture} from "./DataTexture";

import {SDKErrorType, SDKResult} from "../../../../core";

/**
 * Manages a GPU-side texture for storing model matrices (mat4) for meshes.
 *
 * The `DTXMatrixArray` class provides efficient storage and management of 4x4 transformation matrices
 * for WebGL rendering. Each matrix is stored as four consecutive RGBA32F texels in a GPU texture.
 * The class buffers matrix updates and performs batched, partial uploads to the GPU for optimal performance.
 *
 * ### Features:
 * - **Matrix Storage**: Stores up to `maxItems` 4x4 matrices in a GPU texture.
 * - **Efficient Updates**: Buffers changes and uploads only dirty regions to the GPU.
 * - **Row-Aligned Batching**: Groups contiguous updates within the same texture row for efficient flushing.
 * - **Integration**: Designed for use in WebGL rendering pipelines.
 *
 * ### Usage:
 * - Use `setMatrix(tileIndex, matrix)` to update a matrix at a specific tileIndex.
 * - Call `uploadChanges()` to upload all dirty matrices to the GPU.
 * - Use `destroy()` to release GPU resources when no longer needed.
 *
 * ### Lifecycle:
 * 1. Initialize with a WebGL2 context and optional maximum matrix count.
 * 2. Update matrices as needed using `setMatrix()`.
 * 3. Periodically call `uploadChanges()` to synchronize changes with the GPU.
 * 4. Clean up resources with `destroy()`.
 *
 */
export class DTXMatrixTable extends DataTexture {

  private _gl: WebGL2RenderingContext;
  private lastFreeMatrixIndex: number;
  private dirtyIndices: Set<number>;
  private _getNumItems: () => number;

  /**
   * Creates a new matrix _buffer for mesh transforms.
   *
   * @param params - Configuration object
   * @param params.gl - WebGL2 context
   * @param params.maxItems - Maximum number of matrices to support (default 2000)
   */
  constructor(params: {
    gl: WebGL2RenderingContext;
    maxItems?: number;
    getNumItems: () => number;
    description?: string;
  }) {
    super();
    this.description = params.description || "meshIndex -> Mat4";
    this._gl = params.gl;
    this.lastFreeMatrixIndex = 0;
    this.maxItems = params.maxItems || 2000;
    this.dirtyIndices = new Set();
    this._getNumItems = params.getNumItems ;
  }

  /**
   * Number of logical items currently stored in this texture.
   */
  get numItems(): number {
    return this._getNumItems();
  }

  /**
   * Size in bytes of a single item (mat4).
   */
  static get itemSizeInBytes() {
    return 16 * 4; // 16 floats per mat4, 4 bytes per float
  }

  /**
   * Gets the total capacity in bytes of the matrix array.
   */
  getAllocatedBytes(): number {
    return this.maxItems * DTXMatrixTable.itemSizeInBytes;
  }

  /**
   * Gets the currently allocated bytes based on number of matrices in use.
   */
  getUsedBytes(): number {
    return this._getNumItems() * DTXMatrixTable.itemSizeInBytes;
  }

  /**
   * Allocates the data texture and backing array for matrix storage.
   * Each mat4 takes 4 texels (RGBA32F), and the texture is laid out in rows.
   */
  allocate(): SDKResult<void> {
    const matricesPerRow = 512; // Must be multiple of 4 for RGBA32F
    const texelsPerMatrix = 4; // 4 texels per mat4
    const componentsPerTexel = 4; // RGBA
    const width = matricesPerRow * texelsPerMatrix; // 512 matrices per row × 4 texels per matrix
    const textureHeight = Math.ceil(this.maxItems / (width / texelsPerMatrix));
    const requiredFloats = width * textureHeight * texelsPerMatrix * componentsPerTexel;
    this.buffer = new Float32Array(requiredFloats);
    this.width = width;
    this.height = textureHeight;
    return this._allocateTexture();
  }

  _allocateTexture(): SDKResult<void> {
    const gl = this._gl;
    const texture = gl.createTexture()!;
    if (!texture) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[DTXMatrixTable]: Failed to create texture"
      };
    }
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, this.width, this.height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (e) {
      gl.deleteTexture(texture);
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[DTXMatrixTable]: Exception during texture allocation: ${e}`
      };
    }
    this.texture = texture;
    return {
      ok: true,
      value: undefined
    };
  }

  webglContextRestored(): SDKResult<void> {
    return this._allocateTexture();
  }

  /**
   * Sets the model matrix for a mesh at a given tileIndex.
   * Buffers the change until the next `uploadChanges()` call.
   *
   * @param index - Index of the mesh to update
   * @param matrix - 16-component FloatArray (mat4) in column-major order
   */
  setMatrix(index: number, matrix: FloatArrayParam): void {
    this.buffer.set(matrix, index * 16);
    this.dirtyIndices.add(index);
  }


  /**
   * Uploads all dirty (changed) matrices to the GPU in batched, row-aligned subimage calls.
   * Batches contiguous ranges within the same texture row for efficient flushing.
   */
  uploadChanges(): boolean {

    if (this.dirtyIndices.size === 0) {
      return false;
    }

    this.notifyUpdated();

    const gl = this._gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const matricesPerRow = this.width / 4;

    const sortedIndices = Array.from(this.dirtyIndices).sort((a, b) => a - b);
    let start = sortedIndices[0];
    let end = start;

    const buffer = this.buffer;

    for (let i = 1; i <= sortedIndices.length; i++) {
      const current = sortedIndices[i];
      const sameRow = current !== undefined &&
        Math.floor(current / matricesPerRow) === Math.floor(end / matricesPerRow);
      const contiguous = current === end + 1;

      if (contiguous && sameRow) {
        end = current;
      } else {
        // Flush the current batch
        const row = Math.floor(start / matricesPerRow);
        const col = (start % matricesPerRow) * 4;
        const count = end - start + 1;
        const offset = start * 16;

        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          col,
          row,
          count * 4, // 4 texels per matrix
          1,
          gl.RGBA,
          gl.FLOAT,
          buffer.subarray(offset, offset + count * 16)
        );

        // Start a new batch
        start = current;
        end = current;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.dirtyIndices.clear();

    return true;
  }

  /**
   * Samples the matrix stored at the given texel coordinates.
   * @param x
   * @param y
   */
  readAtTexel(x: number, y: number): Mat4 {
    const matricesPerRow = this.width / 4;
    const matrixIndex = y * matricesPerRow + Math.floor(x / 4);
    const offset = matrixIndex * 16;
    const matrix = <Mat4>Array.from(this.buffer.subarray(offset, offset + 16));
    return matrix;
  }

  getItem(matrixIndex: number): {matrix:Mat4 } {
    const offset = matrixIndex * 16;
    return {matrix: <Mat4>Array.from(this.buffer.subarray(offset, offset + 16))};
  }

  webglContextRestored(): void {

  }

  destroy(): void {
    if (this.texture) {
      this.buffer = null as unknown as Float32Array<ArrayBuffer>;
      this._gl?.deleteTexture(this.texture);
    }
  }
}
