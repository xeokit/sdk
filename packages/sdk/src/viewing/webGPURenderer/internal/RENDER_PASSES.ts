/**
 * Rendering passes currently supported by WebGPURenderer.
 *
 * @internal
 */
export const RENDER_PASSES = {
  NOT_RENDERED: 0,
  OPAQUE: 1,
  TRANSPARENT: 2
} as const;

/**
 * Type representing WebGPU render pass values.
 */
export type WebGPURenderPassValue = typeof RENDER_PASSES[keyof typeof RENDER_PASSES];
