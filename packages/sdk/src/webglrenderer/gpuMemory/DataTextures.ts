import {DataTexturesLayer} from "./DataTexturesLayer";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";

/**
 * Interface representing GPU-resident data textures for tile view matrices and layers.
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
   * Array of DataTexturesLayer, each containing the renderable output of a GPUMemoryLayer.
   *
   * These are global to all GPUMemoryLayer instances, and are indexed using {@link GPUMemoryLayer.layerIndex | GPUMemoryLayer.layerIndex}.
   */
  layers: DataTexturesLayer[];
}

