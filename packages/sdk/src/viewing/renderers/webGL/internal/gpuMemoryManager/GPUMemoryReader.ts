import {type RendererGPUResources} from "./RendererGPUResources";
import {SceneMesh} from "../../../../../model/scene";

/**
 * Interface that provides the GPU-side memory resources used by draw techniques.
 *
 * The preferred property is `gpuResources`; `dataTextures` remains as a
 * compatibility alias for the original DTX renderer path. Batch entries may
 * now also include VBO-backed geometry resources.
 *
 * @internal
 */
export interface GPUMemoryReader {

  /**
   * GPU-side memory resource bundle exposed to renderer internals.
   */
  gpuResources: RendererGPUResources;

  /**
   * Backwards-compatible name for {@link gpuResources}.
   */
  dataTextures: RendererGPUResources;

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
