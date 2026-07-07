/**
 * Minimal WebGPU texture shape used by WebGPURenderer.
 */
export interface WebGPUTextureLike {
  createView(): unknown;
  destroy?(): void;
}
