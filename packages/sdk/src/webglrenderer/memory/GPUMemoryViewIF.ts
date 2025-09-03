import {type DataTextures} from "./DataTextures";

/**
 * Interface representing a view into the data texture memory (GPUMemory) used for GPU-side model storage.
 */
export interface GPUMemoryViewIF {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemory.
   */
  dataTextures: DataTextures;
}
