import {WebGLDataTexture} from "../index";
import {type FloatArrayParam} from "../../math";

/**
 * Manages a GPU-side texture for storing model matrices (mat4) for meshes.
 *
 * The `DTXMatrixArray` class provides efficient storage and management of 4x4 transformation matrices
 * for WebGL rendering. Each matrix is stored as four consecutive RGBA32F texels in a GPU texture.
 * The class buffers matrix updates and performs batched, partial uploads to the GPU for optimal performance.
 *
 * ### Features:
 * - **Matrix Storage**: Stores up to `maxMatrices` 4x4 matrices in a GPU texture.
 * - **Efficient Updates**: Buffers changes and uploads only dirty regions to the GPU.
 * - **Row-Aligned Batching**: Groups contiguous updates within the same texture row for efficient flushing.
 * - **Integration**: Designed for use in WebGL rendering pipelines.
 *
 * ### Usage:
 * - Use `setMatrix(index, matrix)` to update a matrix at a specific index.
 * - Call `flush()` to upload all dirty matrices to the GPU.
 * - Use `destroy()` to release GPU resources when no longer needed.
 *
 * ### Lifecycle:
 * 1. Initialize with a WebGL2 context and optional maximum matrix count.
 * 2. Update matrices as needed using `setMatrix()`.
 * 3. Periodically call `flush()` to synchronize changes with the GPU.
 * 4. Clean up resources with `destroy()`.
 *
 */
export class DTXMatrixArray {

  public texture: WebGLDataTexture;

  private gl: WebGL2RenderingContext;
  private lastFreeMatrixIndex: number;
  private numMatrices: number;
  private maxMatrices: number;
  private dirtyIndices: Set<number>;

  /**
   * Creates a new matrix buffer for mesh transforms.
   *
   * @param params - Configuration object
   * @param params.gl - WebGL2 context
   * @param params.maxMatrices - Maximum number of matrices to support (default 2000)
   */
  constructor(params: {
    gl: WebGL2RenderingContext;
    maxMatrices?: number;
  }) {
    this.gl = params.gl;
    this.lastFreeMatrixIndex = 0;
    this.numMatrices = 0;
    this.maxMatrices = params.maxMatrices || 2000;
    this.dirtyIndices = new Set();
    this.allocate();
  }

  /**
   * Allocates the data texture and backing array for matrix storage.
   * Each mat4 takes 4 texels (RGBA32F), and the texture is laid out in rows.
   */
  allocate(): void {

    const textureWidth = 512 * 4; // 512 matrices per row × 4 texels per matrix
    const textureHeight = Math.ceil(this.maxMatrices / (textureWidth / 4));
    const textureData = new Float32Array(4 * textureWidth * textureHeight);

    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, textureData, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.texture = new WebGLDataTexture({
      gl,
      texture,
      textureWidth,
      textureHeight,
      textureData
    });
  }

  /**
   * Sets the model matrix for a mesh at a given index.
   * Buffers the change until the next `flush()` call.
   *
   * @param index - Index of the mesh to update
   * @param matrix - 16-component FloatArray (mat4) in column-major order
   */
  setMatrix(index: number, matrix: FloatArrayParam): void {
    this.texture.textureData.set(matrix, index * 16);
    this.dirtyIndices.add(index);
  }

  /**
   * Uploads all dirty (changed) matrices to the GPU in batched, row-aligned subimage calls.
   * Batches contiguous ranges within the same texture row for efficient flushing.
   */
  flush(): void {

    if (this.dirtyIndices.size === 0) {
      return;
    }

    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture.texture);

    const matricesPerRow = this.texture.textureWidth / 4;

    const sortedIndices = Array.from(this.dirtyIndices).sort((a, b) => a - b);
    let start = sortedIndices[0];
    let end = start;

    const textureData = this.texture.textureData;

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
          textureData.subarray(offset, offset + count * 16)
        );

        // Start a new batch
        start = current;
        end = current;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.dirtyIndices.clear();
  }

  /**
   * Destroys the internal resources.
   * (No-op unless cleanup is explicitly implemented.)
   */
  destroy(): void {
    // No-op for now. Could delete texture if needed:
    this.gl.deleteTexture(this.texture.texture);
  }
}
