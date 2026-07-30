import type {SDKResult} from "../../../../../base/core";

/**
 * GPU resource that can be allocated and destroyed by an owning batch.
 *
 * @internal
 */
export type AllocatableGPUResource = {
  allocate(): SDKResult<void>;
  destroy(): void;
};

/**
 * GPU resource that can be rebound to a restored WebGL context.
 *
 * @internal
 */
export type RestorableGPUResource = {
  webglContextRestored(): SDKResult<void>;
  setWebGLContext?(gl: WebGL2RenderingContext): void;
};

/**
 * GPU resource that reports allocated and used byte counts.
 *
 * @internal
 */
export type ByteSizedGPUResource = {
  getAllocatedBytes(): number;
  getUsedBytes(): number;
};

/**
 * GPU resource that can upload pending CPU-side changes.
 *
 * @internal
 */
export type UploadableGPUResource = {
  uploadChanges(): boolean;
};

/**
 * Full lifecycle contract implemented by batch-owned textures and VBO stores.
 *
 * @internal
 */
export type GPUResource = AllocatableGPUResource
  & RestorableGPUResource
  & ByteSizedGPUResource
  & UploadableGPUResource;

export function allocateGPUResources(resources: AllocatableGPUResource[]): SDKResult<void> {
  for (let i = 0, len = resources.length; i < len; i++) {
    const result = resources[i].allocate();
    if (result.ok === false) {
      for (let j = i - 1; j >= 0; j--) {
        resources[j].destroy();
      }
      return result;
    }
  }
  return {ok: true, value: undefined};
}

export function destroyGPUResources(resources: AllocatableGPUResource[]): void {
  for (let i = 0, len = resources.length; i < len; i++) {
    resources[i].destroy();
  }
}

export function getGPUResourcesAllocatedBytes(resources: ByteSizedGPUResource[]): number {
  let total = 0;
  for (let i = 0, len = resources.length; i < len; i++) {
    total += resources[i].getAllocatedBytes();
  }
  return total;
}

export function getGPUResourcesUsedBytes(resources: ByteSizedGPUResource[]): number {
  let total = 0;
  for (let i = 0, len = resources.length; i < len; i++) {
    total += resources[i].getUsedBytes();
  }
  return total;
}

export function restoreGPUResources(
  resources: RestorableGPUResource[],
  gl: WebGL2RenderingContext
): SDKResult<void> {
  for (const resource of resources) {
    resource.setWebGLContext?.(gl);
    const result = resource.webglContextRestored();
    if (result.ok === false) {
      return result;
    }
  }
  return {ok: true, value: undefined};
}
