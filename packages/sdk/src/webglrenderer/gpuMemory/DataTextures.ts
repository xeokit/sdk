import {DataTexturesBatch} from "./DataTexturesBatch";

/**
 * Interface representing GPU-resident data textures for tile view matrices and batches.
 */
export interface DataTextures {

  /**
   * Array of data textures, each containing tile view matrices for specific views.
   */
  tileViewMatrices: WebGLTexture[];

  /**
   * Array of data textures, each containing tile ray pick matrices for specific views.
   */
  tileRayPickMatrices: WebGLTexture[];

  /**
   * Array of DataTexturesLayer, each containing the renderable output of a GPUMemoryBatch.
   *
   * These are indexed using {@link GPUMemoryBatch.batchIndex | GPUMemoryBatch.batchIndex}.
   */
  batches: DataTexturesBatch[];
}

