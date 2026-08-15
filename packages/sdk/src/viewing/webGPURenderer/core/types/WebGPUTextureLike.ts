/**
 * Minimal WebGPU texture shape used by WebGPURenderer.
 */
export interface WebGPUTextureLike {
  createView(descriptor?: object): unknown;
  destroy?(): void;
}
