import type {Mat4} from "../../../../../base/math/matrix";

/**
 * A handle to a mesh stored in GPU memory.
 *
 * @internal
 */
export interface GPUMemoryMeshHandle {

  /**
   * Index of the batch containing the mesh.
   */
  gpuMemoryBatchIndex: number;

  /**
   * Index of the mesh within the batch.
   */
  meshIndex: number;

}

/**
 * Initial or updated tile-relative placement for a mesh in GPU memory.
 *
 * @internal
 */
export interface GPUMemoryMeshPlacement {
  tileIndex: number;
  rtcMatrix: Mat4;
}
