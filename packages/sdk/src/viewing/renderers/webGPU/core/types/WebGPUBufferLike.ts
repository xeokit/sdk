/**
 * Minimal WebGPU buffer shape used by WebGPURenderer.
 */
export interface WebGPUBufferLike {
  getMappedRange?(): ArrayBuffer;
  mapAsync?(mode: number): Promise<void>;
  unmap?(): void;
  destroy?(): void;
}
