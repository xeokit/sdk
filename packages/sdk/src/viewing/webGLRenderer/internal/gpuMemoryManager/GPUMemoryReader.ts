import {type DataTextures} from "./DataTextures";
import {SceneMesh} from "../../../../model/scene";

/**
 * Interface that provides the data textures that implement the GPU-side memory.
 * This interface is used within `DrawTechnique` instances to access the GPU memory resources.
 *
 * @internal
 */
export interface GPUMemoryReader {

  /**
   * The data textures.
   */
  dataTextures: DataTextures;

  /**
   * Retrieves a SceneMesh from a specific batch at the given index.
   * This supports picking, where we need to map from each mesh's fragments, containing the RGBA-encoded batch and mesh indices,
   * back to the SceneMesh instance.
   * @param batchIndex
   * @param meshIndex
   */
  getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh;

  /**
   * Retrieves parameters for a drawArrays() call to render a specific mesh within a specific batch.
   * This supports surface-picking, where we only draw the specific mesh being surface-picked.
   * @param batchIndex
   * @param meshIndex
   */
  getDrawArraysParamsForMesh( batchIndex: number, meshIndex: number ): { first: number, count: number} | null
}
