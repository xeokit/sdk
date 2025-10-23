import {DataTexturesBatch} from "./DataTexturesBatch";

/**
 * Interface representing GPU-resident data textures for tile view matrices and sortedBatches.
 */
export interface DataTextures {

  /**
   * Array of data textures, each containing tile view matrices for specific viewManager.
   */
  tileViewMatrices: WebGLTexture[];

  /**
   * Array of data textures, each containing tile ray pick matrices for specific viewManager.
   */
  tileRayPickMatrices: WebGLTexture[];

  /**
   * Array of DataTexturesLayer, each containing the renderable output of a GPUMemoryBatch.
   *
   * These are indexed using {@link GPUMemoryBatch.batchIndex | GPUMemoryBatch.batchIndex}.
   */
  batches: DataTexturesBatch[];
}

