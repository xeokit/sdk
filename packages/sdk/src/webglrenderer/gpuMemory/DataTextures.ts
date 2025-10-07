import {DataTexturesBatch} from "./DataTexturesBatch";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";

/**
 * Interface representing GPU-resident data textures for tile view matrices and batches.
 */
export interface DataTextures {

  /**
   * Array of data textures, each containing tile view matrices for specific views.
   */
  tileViewMatrices: DTXMatrixArray[];

  /**
   * Array of data textures, each containing tile ray pick matrices for specific views.
   */
  tileRayPickMatrices: DTXMatrixArray[];

  /**
   * Array of DataTexturesLayer, each containing the renderable output of a GPUMemoryBatch.
   *
   * These are indexed using {@link GPUMemoryBatch.batchIndex | GPUMemoryBatch.batchIndex}.
   */
  batches: DataTexturesBatch[];
}

