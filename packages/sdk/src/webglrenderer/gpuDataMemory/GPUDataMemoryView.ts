import {type GPUDataTextures} from "./GPUDataTextures";

/**
 * Interface representing a view into the data texture memory (GPUDataMemory) used for GPU-side model storage.
 */
export interface GPUDataMemoryView {

  /**
   * The data textures that implement GPU-side model storage for this GPUDataMemory.
   */
  dataTextures: GPUDataTextures;
}
