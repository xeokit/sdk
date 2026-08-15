/**
 * Rendering passes currently supported by WebGPURenderer.
 *
 * @internal
 */
export const RENDER_PASSES = {
  NOT_RENDERED: 0,
  OPAQUE: 1,
  TRANSPARENT: 2,
  PICK: 3,
  SECTION_PLANE_CAPS: 4,
  STENCIL_MASK_FRONT: 5,
  STENCIL_MASK_BACK: 6,
  DEPTH_PREPASS: 7,
  SHADOW_DEPTH: 8
} as const;

/**
 * Type representing WebGPU render pass values.
 */
export type WebGPURenderPassValue = typeof RENDER_PASSES[keyof typeof RENDER_PASSES];
