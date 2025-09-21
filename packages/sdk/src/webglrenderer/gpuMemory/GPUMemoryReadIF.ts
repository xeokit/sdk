import {type DataTextures} from "./DataTextures";

/**
 * Interface representing a view into the data texture gpuMemory (GPUMemoryLayer) used for GPU-side model storage.
 */
export interface GPUMemoryReadIF {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemoryLayer.
   */
  dataTextures: DataTextures;
}
