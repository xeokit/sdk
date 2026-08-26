/**
 * Descriptor passed to `GPUAdapter.requestDevice`.
 *
 * This is intentionally structural so callers can pass a browser
 * `GPUDeviceDescriptor` when available without forcing WebGPU DOM typings into
 * every TypeScript environment.
 */
export type WebGPUDeviceDescriptor = object;
