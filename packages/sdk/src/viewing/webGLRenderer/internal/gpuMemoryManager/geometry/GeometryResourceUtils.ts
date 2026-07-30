import {
  allocateGPUResources,
  destroyGPUResources,
  getGPUResourcesAllocatedBytes,
  getGPUResourcesUsedBytes,
  restoreGPUResources,
  type GPUResource
} from "../resources/GPUResourceLifecycle";

/**
 * Minimal lifecycle contract for GPU resources owned by a geometry storage.
 *
 * DTX textures and VBO batches both implement these methods, which lets storage
 * implementations allocate, destroy, restore, upload, and report memory usage
 * through the same helper functions.
 *
 * @internal
 */
export type BatchGeometryResource = GPUResource;

export const allocateGeometryResources = allocateGPUResources;
export const destroyGeometryResources = destroyGPUResources;
export const getGeometryResourcesAllocatedBytes = getGPUResourcesAllocatedBytes;
export const getGeometryResourcesUsedBytes = getGPUResourcesUsedBytes;
export const restoreGeometryResources = restoreGPUResources;
