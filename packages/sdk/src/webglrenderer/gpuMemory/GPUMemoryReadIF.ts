import {type DataTextures} from "./DataTextures";

/**
 * Interface that provides the data textures that implement the GPU-side memory.
 * This interface is used within `DrawOp` instances to access the GPU memory resources.
 */
export interface GPUMemoryReadIF {

  /**
   * The data textures.
   */
  dataTextures: DataTextures;
}
