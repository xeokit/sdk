import {type DataTextures} from "./DataTextures";

/**
 * Interface that provides the data textures that implement the GPU-side memory.
 * This interface is used within `DrawTechnique` instances to access the GPU memory resources.
 */
export interface DTXMemoryReader {

  /**
   * The data textures.
   */
  dataTextures: DataTextures;
}
